import {
    UnifiedSynth,
    getFactoryPreset,
    mergePresetWithBase,
    applyTrackPerformanceControls
} from './UnifiedSynth.js';

export class DrumVoice {
    constructor(ctx, output, noiseBuffer) {
        this.ctx = ctx;
        this.output = output;
        this.noiseBuffer = noiseBuffer;

        this.synthType = null; // e.g. 'playBD', 'playSD', etc.
        this.trackId = null;   // e.g. 'bd', 'sd', 'lt', 'mt', 'ht', 'rs', 'cp'
        this.sampleBuffer = null; // Factory sample
        this.customBuffer = null; // User sample
        this.type = 'standard'; // 'standard', 'hat', 'cymbal'

        // Unified Synth instance (lazy init)
        this.synth = null;
        this.activeSamples = [];
        this._presetCacheKey = null;
        this._presetCacheSource = null;
        this._presetCacheValue = null;

        // Hybrid Configuration
        this.layerSynthAndSample = false;
    }

    setSynth(type) {
        this.synthType = type;
        // Map synthType to trackId
        const typeToId = {
            'playBD': 'bd', 'playSD': 'sd',
            'playLowTom': 'lt', 'playMidTom': 'mt', 'playHiTom': 'ht',
            'playRim': 'rs', 'playCP': 'cp'
        };
        this.trackId = typeToId[type] || null;
    }

    setSample(buffer) {
        this.sampleBuffer = buffer;
    }

    setCustomSample(buffer) {
        this.customBuffer = buffer;
    }

    _getSynth() {
        if (!this.synth) {
            this.synth = new UnifiedSynth(this.ctx, this.output, this.noiseBuffer);
        }
        return this.synth;
    }

    _makePresetCacheKey(params = {}) {
        return [
            this.trackId || '',
            Number.isFinite(params.p1) ? params.p1 : '',
            Number.isFinite(params.p2) ? params.p2 : '',
            Number.isFinite(params.p3) ? params.p3 : '',
            Number.isFinite(params.decay) ? params.decay : '',
            Number.isFinite(params.vol) ? params.vol : '',
            Number.isFinite(params.accent) ? params.accent : '',
            Number.isFinite(params.ch_decay) ? params.ch_decay : '',
            Number.isFinite(params.oh_decay) ? params.oh_decay : '',
            Number.isFinite(params.cr_tune) ? params.cr_tune : '',
            Number.isFinite(params.rd_tune) ? params.rd_tune : ''
        ].join('|');
    }

    _getPlayablePreset(params = {}, forceFactory = false) {
        if (!this.trackId) return null;

        const customSynth = !forceFactory && params.customSynth && Object.keys(params.customSynth).length > 0
            ? params.customSynth
            : null;
        const key = this._makePresetCacheKey(params);
        if (
            this._presetCacheValue &&
            this._presetCacheSource === customSynth &&
            this._presetCacheKey === key
        ) {
            return this._presetCacheValue;
        }

        const preset = customSynth
            ? this._mergeWithFactory(customSynth)
            : getFactoryPreset(this.trackId);
        this._applyKnobParams(preset, params);

        this._presetCacheSource = customSynth;
        this._presetCacheKey = key;
        this._presetCacheValue = preset;
        return preset;
    }

    _cleanupSamples() {
        const active = [];
        for (const item of this.activeSamples) {
            if (!item.ended) active.push(item);
        }
        this.activeSamples = active;
    }

    trigger(time, params) {
        const now = time;
        params = params || {};
        this._cleanupSamples();

        // 1. Custom Sample (Highest Priority)
        if (this.customBuffer) {
            this.playSampleBuffer(now, this.customBuffer, params);
            if (!this.layerSynthAndSample) return;
        }

        // 2. Custom Synth Patch (from DrumSynth Maker)
        const hasCustomSynth = params.customSynth && Object.keys(params.customSynth).length > 0;
        if (hasCustomSynth) {
            const customPreset = this._getPlayablePreset(params);
            if (customPreset) this._getSynth().play(customPreset, now);
            if (!this.layerSynthAndSample) return;
        }

        // 3. Factory Synth (use preset from UnifiedSynth)
        if (this.trackId) {
            const factoryPreset = this._getPlayablePreset(params, true);
            if (factoryPreset) this._getSynth().play(factoryPreset, now);
            return;
        }

        // 4. Factory Sample (for CH/OH/CR/RD)
        if (this.sampleBuffer) {
            this.playSampleBuffer(now, this.sampleBuffer, params);
        }
    }

    // Normalize saved patch payload (legacy base metadata stripped in UnifiedSynth helper).
    _mergeWithFactory(customSynth) {
        if (!this.trackId) return JSON.parse(JSON.stringify(customSynth || {}));
        return mergePresetWithBase(this.trackId, customSynth);
    }

    stop(time = this.ctx.currentTime) {
        if (this.synth) {
            this.synth.stopAll();
        }
        const stopAt = Number.isFinite(time) ? Math.max(time, this.ctx.currentTime) : this.ctx.currentTime;
        this.activeSamples.forEach(item => {
            try { item.src.stop(stopAt); } catch (e) { }
            try { item.src.disconnect(); } catch (e) { }
            try { item.gain.disconnect(); } catch (e) { }
            item.ended = true;
        });
        this.activeSamples = [];
    }

    // Apply TR909 knob values (p1, p2, p3) to preset
    _applyKnobParams(preset, P) {
        if (!this.trackId) return;
        applyTrackPerformanceControls(
            preset,
            this.trackId,
            P || {},
            preset?.previewProfile || null
        );
    }

    playSampleBuffer(time, buffer, P, playbackRate = 1.0) {
        if (!buffer) return;
        if (!P) return;

        const vol = (P.vol !== undefined) ? P.vol : (P.level !== undefined ? P.level / 100 : 1);

        const src = this.ctx.createBufferSource();
        src.buffer = buffer;

        // Tuning / Rate
        let rate = playbackRate;
        if (this.type === 'hat') {
            if (P.p2 !== undefined) rate = 0.8 + (P.p2 / 100) * 0.4;
            else if (P.tune !== undefined) rate = 0.8 + (P.tune / 100) * 0.4;
        } else if (this.type === 'cymbal') {
            const tuneVal = P.cr_tune || P.rd_tune || P.tune || 50;
            rate = 0.6 + (tuneVal / 100) * 1.0;
        }

        src.playbackRate.setValueAtTime(rate, time);

        const gain = this.ctx.createGain();
        const startGain = Math.max(0.001, vol * 1.5);
        gain.gain.setValueAtTime(startGain, time);

        // Decay
        let decayTime = 0.5;
        if (this.type === 'hat') {
            const decayVal = P.ch_decay || P.oh_decay || P.decay || 50;
            decayTime = 0.02 + (decayVal / 100) * 0.1;
            if (this.decayCurve === 'long' || P.oh_decay !== undefined) {
                decayTime = 0.1 + (decayVal / 100) * 0.8;
            }
        } else if (this.type === 'cymbal') {
            decayTime = P.cr_tune ? 1.5 : 2.5;
        } else {
            if (P.decay) decayTime = 0.05 + (P.decay / 100) * 2.0;
        }

        gain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);

        src.connect(gain);
        gain.connect(this.output);
        const item = { src, gain, ended: false };
        src.onended = () => {
            item.ended = true;
            try { src.onended = null; } catch (e) { }
            try { src.disconnect(); } catch (e) { }
            try { gain.disconnect(); } catch (e) { }
        };
        this.activeSamples.push(item);
        src.start(time);
        src.stop(time + decayTime + 0.1);
    }
}
