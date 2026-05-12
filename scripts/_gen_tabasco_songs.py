"""One-off generator for the remaining 6 Tabasco song JSONs.
Run from Music/ directory: python scripts/_gen_tabasco_songs.py"""
import json, os

def hat_8th(velocity_base=0.40):
    events = []
    for beat in range(4):
        for sub in [0, 2]:
            v = velocity_base + (0.04 if sub == 0 else 0.0) + (0.03 if beat == 0 else 0.0)
            events.append({"instrument":"hat","beat":beat,"sub":sub,"velocity":round(v,2),"microMs":0 if sub==0 else 1,"role":"closed_8th"})
    return events

def hat_16th(velocity_base=0.45):
    events = []
    for beat in range(4):
        for sub in range(4):
            v = velocity_base + (0.04 if sub == 0 else 0.0) + (0.03 if beat == 0 else 0.0)
            events.append({"instrument":"hat","beat":beat,"sub":sub,"velocity":round(v,2),"microMs":0 if sub==0 else 1,"role":"16th_drive" if sub==0 else "16th_fill"})
    return events

def hat_offbeat_ska():
    events = []
    for beat in [1, 3]:
        events.append({"instrument":"hat","beat":beat,"sub":0,"velocity":0.50,"microMs":2,"role":"ska_upstroke"})
    return events

def kick_4floor(velocity_base=0.86):
    events = []
    for beat in range(4):
        v = round(velocity_base + (0.04 if beat in (0,2) else 0.0), 2)
        events.append({"instrument":"kick","beat":beat,"sub":0,"velocity":v,"microMs":-2,"role":"4-on-floor"})
    return events

def kick_1and3(velocity_base=0.82):
    return [
        {"instrument":"kick","beat":0,"sub":0,"velocity":round(velocity_base+0.02,2),"microMs":-2,"role":"anchor"},
        {"instrument":"kick","beat":2,"sub":0,"velocity":round(velocity_base-0.04,2),"microMs":-1,"role":"anchor"}
    ]

def snare_24(velocity_base=0.80, lag_ms=4):
    return [
        {"instrument":"snare","beat":1,"sub":0,"velocity":round(velocity_base-0.02,2),"microMs":lag_ms,"role":"backbeat"},
        {"instrument":"snare","beat":3,"sub":0,"velocity":round(velocity_base+0.02,2),"microMs":lag_ms+1,"role":"backbeat"}
    ]

def cowbell_offbeat(velocity_base=0.36):
    events = []
    for beat in range(4):
        v = round(velocity_base + (0.04 if beat == 3 else 0.0), 2)
        events.append({"instrument":"ghost","beat":beat,"sub":2,"velocity":v,"microMs":10,"role":"cowbell_offbeat"})
    return events

def clap_doubling(velocity_base=0.48):
    return [
        {"instrument":"ghost","beat":1,"sub":0,"velocity":round(velocity_base-0.02,2),"microMs":6,"role":"clap_double"},
        {"instrument":"ghost","beat":3,"sub":0,"velocity":round(velocity_base+0.02,2),"microMs":7,"role":"clap_double"}
    ]

def brush_softer(velocity_base=0.18):
    events = [
        {"instrument":"snare","beat":1,"sub":0,"velocity":round(velocity_base+0.18,2),"microMs":12,"role":"brush_backbeat"},
        {"instrument":"snare","beat":3,"sub":0,"velocity":round(velocity_base+0.20,2),"microMs":14,"role":"brush_backbeat"}
    ]
    for beat in range(4):
        events.append({"instrument":"ghost","beat":beat,"sub":2,"velocity":round(velocity_base-0.04,2),"microMs":16,"role":"brush_sweep"})
    return events

songs = {}

# ----- 01 TABASCO -----
songs["tabasco"] = {
    "title": "TABASCO", "bpm": 136, "key": "D minor", "duration": 44,
    "session_signature": "Backdrop Bomb mixture chant + punk drive (short opener)",
    "structure": [
        {"section": "intro",   "frame_id": "intro_drive",   "bars": 4},
        {"section": "chant-a", "frame_id": "chant_drive",   "bars": 8},
        {"section": "chant-b", "frame_id": "chant_release", "bars": 8},
        {"section": "outro",   "frame_id": "outro_punch",   "bars": 2}
    ],
    "frames": {
        "intro_drive": kick_4floor(0.84) + hat_16th(0.42) + snare_24(0.78,4),
        "chant_drive": kick_4floor(0.90) + snare_24(0.84,3) + hat_16th(0.48) + cowbell_offbeat(0.40) + clap_doubling(0.50),
        "chant_release": kick_4floor(0.94) + snare_24(0.90,3) + hat_16th(0.52) + clap_doubling(0.58) + [
            {"instrument":"fill","beat":3,"sub":2,"velocity":0.52,"microMs":8,"role":"tom_fill"},
            {"instrument":"fill","beat":3,"sub":3,"velocity":0.60,"microMs":10,"role":"tom_fill"}
        ],
        "outro_punch": [
            {"instrument":"kick","beat":0,"sub":0,"velocity":0.96,"microMs":-3,"role":"final"},
            {"instrument":"snare","beat":0,"sub":0,"velocity":0.92,"microMs":3,"role":"final"},
            {"instrument":"crash","beat":0,"sub":0,"velocity":0.78,"microMs":2,"role":"final_crash"},
            {"instrument":"kick","beat":2,"sub":0,"velocity":0.94,"microMs":-2,"role":"final_2"},
            {"instrument":"snare","beat":2,"sub":0,"velocity":0.90,"microMs":4,"role":"final_2"}
        ]
    },
    "chord_progression": {
        "intro":   [["Dm", 4]],
        "chant-a": [["Dm", 2], ["F", 2], ["C", 2], ["A", 2]],
        "chant-b": [["Dm", 2], ["Bb", 2], ["F", 2], ["A", 2]],
        "outro":   [["Dm", 2]]
    }
}

# ----- 02 Hey -----
songs["hey"] = {
    "title": "Hey", "bpm": 123, "key": "G major", "duration": 304,
    "session_signature": "LCD Soundsystem pop-rock pulse + cowbell + sing-along chorus",
    "structure": [
        {"section":"intro","frame_id":"intro_pulse","bars":8},
        {"section":"verse-1","frame_id":"verse_groove","bars":16},
        {"section":"chorus-1","frame_id":"chorus_hook","bars":16},
        {"section":"verse-2","frame_id":"verse_groove","bars":16},
        {"section":"chorus-2","frame_id":"chorus_hook","bars":16},
        {"section":"bridge","frame_id":"bridge_drop","bars":8},
        {"section":"chorus-3","frame_id":"chorus_climax","bars":16},
        {"section":"outro","frame_id":"outro_hit","bars":4}
    ],
    "frames": {
        "intro_pulse": kick_1and3(0.76) + hat_8th(0.36),
        "verse_groove": kick_1and3(0.82) + snare_24(0.78,4) + hat_8th(0.42) + [
            {"instrument":"ghost","beat":0,"sub":3,"velocity":0.22,"microMs":8,"role":"ghost"},
            {"instrument":"ghost","beat":2,"sub":3,"velocity":0.24,"microMs":9,"role":"ghost"}
        ],
        "chorus_hook": kick_4floor(0.88) + snare_24(0.84,3) + hat_8th(0.48) + cowbell_offbeat(0.38) + clap_doubling(0.50),
        "bridge_drop": [
            {"instrument":"kick","beat":0,"sub":0,"velocity":0.78,"microMs":-2,"role":"sparse"},
            {"instrument":"snare","beat":2,"sub":2,"velocity":0.40,"microMs":6,"role":"snare_setup"},
            {"instrument":"snare","beat":3,"sub":0,"velocity":0.82,"microMs":4,"role":"drop_pop"}
        ] + [{"instrument":"ghost","beat":b,"sub":2,"velocity":0.20,"microMs":12,"role":"shaker"} for b in range(4)],
        "chorus_climax": kick_4floor(0.92) + snare_24(0.88,3) + hat_16th(0.50) + cowbell_offbeat(0.42) + clap_doubling(0.56) + [
            {"instrument":"fill","beat":3,"sub":2,"velocity":0.50,"microMs":8,"role":"tom_fill"},
            {"instrument":"fill","beat":3,"sub":3,"velocity":0.58,"microMs":10,"role":"tom_fill"},
            {"instrument":"crash","beat":0,"sub":0,"velocity":0.46,"microMs":4,"role":"section_lift"}
        ],
        "outro_hit": [
            {"instrument":"kick","beat":0,"sub":0,"velocity":0.92,"microMs":-3,"role":"final"},
            {"instrument":"snare","beat":1,"sub":0,"velocity":0.88,"microMs":4,"role":"final_bb"},
            {"instrument":"kick","beat":2,"sub":0,"velocity":0.90,"microMs":-2,"role":"final"},
            {"instrument":"snare","beat":3,"sub":0,"velocity":0.94,"microMs":5,"role":"final_bb"},
            {"instrument":"crash","beat":0,"sub":0,"velocity":0.70,"microMs":2,"role":"final_crash"}
        ]
    },
    "chord_progression": {
        "intro":    [["G", 4]],
        "verse-1":  [["G", 4], ["Em", 4], ["C", 4], ["D", 4]],
        "verse-2":  [["G", 4], ["Em", 4], ["C", 4], ["D", 4]],
        "chorus-1": [["C", 2], ["G", 2], ["D", 2], ["Em", 2]],
        "chorus-2": [["C", 2], ["G", 2], ["D", 2], ["Em", 2]],
        "chorus-3": [["C", 2], ["G", 2], ["D", 2], ["Em", 2]],
        "bridge":   [["Am", 4], ["C", 4]],
        "outro":    [["G", 4]]
    }
}

# ----- 03 I got a feeling -----
songs["i-got-a-feeling"] = {
    "title": "I got a feeling", "bpm": 117, "key": "B minor", "duration": 368,
    "session_signature": "Nirvana quiet-loud rock + grunge pocket + extended jam",
    "structure": [
        {"section":"intro","frame_id":"intro_quiet","bars":8},
        {"section":"verse-1","frame_id":"verse_quiet","bars":16},
        {"section":"chorus-1","frame_id":"chorus_loud","bars":16},
        {"section":"verse-2","frame_id":"verse_quiet","bars":16},
        {"section":"chorus-2","frame_id":"chorus_loud","bars":16},
        {"section":"bridge","frame_id":"bridge_jam","bars":16},
        {"section":"chorus-3","frame_id":"chorus_climax","bars":24},
        {"section":"outro","frame_id":"outro_ringout","bars":8}
    ],
    "frames": {
        "intro_quiet": [
            {"instrument":"kick","beat":0,"sub":0,"velocity":0.62,"microMs":-2,"role":"quiet_anchor"},
            {"instrument":"hat","beat":1,"sub":0,"velocity":0.28,"microMs":0,"role":"sparse_hat"},
            {"instrument":"hat","beat":3,"sub":0,"velocity":0.30,"microMs":0,"role":"sparse_hat"}
        ],
        "verse_quiet": kick_1and3(0.70) + [
            {"instrument":"snare","beat":1,"sub":0,"velocity":0.58,"microMs":6,"role":"soft_backbeat"},
            {"instrument":"snare","beat":3,"sub":0,"velocity":0.62,"microMs":7,"role":"soft_backbeat"}
        ] + hat_8th(0.34),
        "chorus_loud": kick_4floor(0.90) + snare_24(0.90,3) + hat_8th(0.50) + [
            {"instrument":"crash","beat":0,"sub":0,"velocity":0.44,"microMs":3,"role":"explode_in"}
        ],
        "bridge_jam": kick_1and3(0.74) + snare_24(0.66,8) + hat_8th(0.38) + [
            {"instrument":"ghost","beat":1,"sub":1,"velocity":0.24,"microMs":12,"role":"snare_ghost"},
            {"instrument":"ghost","beat":3,"sub":3,"velocity":0.26,"microMs":13,"role":"snare_ghost"}
        ],
        "chorus_climax": kick_4floor(0.94) + snare_24(0.92,3) + hat_8th(0.54) + [
            {"instrument":"fill","beat":3,"sub":2,"velocity":0.56,"microMs":8,"role":"tom_fill"},
            {"instrument":"fill","beat":3,"sub":3,"velocity":0.62,"microMs":10,"role":"tom_fill"},
            {"instrument":"crash","beat":0,"sub":0,"velocity":0.52,"microMs":3,"role":"climax_lift"}
        ],
        "outro_ringout": [
            {"instrument":"kick","beat":0,"sub":0,"velocity":0.84,"microMs":-2,"role":"ring_anchor"},
            {"instrument":"snare","beat":2,"sub":0,"velocity":0.78,"microMs":4,"role":"ring_bb"},
            {"instrument":"crash","beat":0,"sub":0,"velocity":0.66,"microMs":3,"role":"long_ring"}
        ]
    },
    "chord_progression": {
        "intro":    [["Bm", 4]],
        "verse-1":  [["Bm", 4], ["D", 4], ["G", 4], ["A", 4]],
        "verse-2":  [["Bm", 4], ["D", 4], ["G", 4], ["A", 4]],
        "chorus-1": [["G", 2], ["D", 2], ["Bm", 2], ["A", 2]],
        "chorus-2": [["G", 2], ["D", 2], ["Bm", 2], ["A", 2]],
        "chorus-3": [["G", 2], ["D", 2], ["Bm", 2], ["A", 2]],
        "bridge":   [["Em", 4], ["G", 4]],
        "outro":    [["Bm", 8]]
    }
}

# ----- 04 Under the Moon -----
songs["under-the-moon"] = {
    "title": "Under the Moon", "bpm": 161, "key": "Bb major", "duration": 313,
    "session_signature": "Ska upstroke + fast punk drive (Tabasco-mixture 5)",
    "structure": [
        {"section":"intro","frame_id":"intro_skank","bars":8},
        {"section":"verse-1","frame_id":"verse_skank","bars":16},
        {"section":"chorus-1","frame_id":"chorus_drive","bars":16},
        {"section":"verse-2","frame_id":"verse_skank","bars":16},
        {"section":"chorus-2","frame_id":"chorus_drive","bars":16},
        {"section":"bridge","frame_id":"bridge_break","bars":8},
        {"section":"chorus-3","frame_id":"chorus_climax","bars":16},
        {"section":"outro","frame_id":"outro_hit","bars":4}
    ],
    "frames": {
        "intro_skank": kick_1and3(0.74) + hat_offbeat_ska() + [
            {"instrument":"snare","beat":1,"sub":0,"velocity":0.62,"microMs":3,"role":"backbeat"},
            {"instrument":"snare","beat":3,"sub":0,"velocity":0.66,"microMs":4,"role":"backbeat"}
        ],
        "verse_skank": kick_1and3(0.78) + snare_24(0.72,3) + hat_offbeat_ska() + [
            {"instrument":"ghost","beat":0,"sub":3,"velocity":0.20,"microMs":8,"role":"ghost"},
            {"instrument":"ghost","beat":2,"sub":3,"velocity":0.22,"microMs":9,"role":"ghost"}
        ],
        "chorus_drive": kick_4floor(0.86) + snare_24(0.84,2) + hat_8th(0.42) + clap_doubling(0.48),
        "bridge_break": [
            {"instrument":"kick","beat":0,"sub":0,"velocity":0.72,"microMs":-2,"role":"sparse"},
            {"instrument":"snare","beat":2,"sub":2,"velocity":0.46,"microMs":6,"role":"setup"},
            {"instrument":"snare","beat":3,"sub":0,"velocity":0.82,"microMs":4,"role":"drop_pop"}
        ] + [{"instrument":"ghost","beat":b,"sub":2,"velocity":0.18,"microMs":12,"role":"shaker"} for b in range(4)],
        "chorus_climax": kick_4floor(0.92) + snare_24(0.90,2) + hat_16th(0.46) + clap_doubling(0.56) + [
            {"instrument":"fill","beat":3,"sub":2,"velocity":0.52,"microMs":8,"role":"tom_fill"},
            {"instrument":"fill","beat":3,"sub":3,"velocity":0.58,"microMs":10,"role":"tom_fill"},
            {"instrument":"crash","beat":0,"sub":0,"velocity":0.46,"microMs":3,"role":"lift"}
        ],
        "outro_hit": [
            {"instrument":"kick","beat":0,"sub":0,"velocity":0.94,"microMs":-3,"role":"final"},
            {"instrument":"snare","beat":1,"sub":0,"velocity":0.90,"microMs":4,"role":"final"},
            {"instrument":"kick","beat":2,"sub":0,"velocity":0.92,"microMs":-2,"role":"final"},
            {"instrument":"snare","beat":3,"sub":0,"velocity":0.94,"microMs":5,"role":"final"},
            {"instrument":"crash","beat":0,"sub":0,"velocity":0.74,"microMs":2,"role":"final_crash"}
        ]
    },
    "chord_progression": {
        "intro":    [["Bb", 4]],
        "verse-1":  [["Bb", 4], ["F", 4], ["Gm", 4], ["Eb", 4]],
        "verse-2":  [["Bb", 4], ["F", 4], ["Gm", 4], ["Eb", 4]],
        "chorus-1": [["Eb", 2], ["Bb", 2], ["F", 2], ["Gm", 2]],
        "chorus-2": [["Eb", 2], ["Bb", 2], ["F", 2], ["Gm", 2]],
        "chorus-3": [["Eb", 2], ["Bb", 2], ["F", 2], ["Gm", 2]],
        "bridge":   [["Cm", 4], ["F", 4]],
        "outro":    [["Bb", 4]]
    }
}

# ----- 05 Electric Sheep -----
songs["electric-sheep"] = {
    "title": "Electric Sheep", "bpm": 129, "key": "E minor", "duration": 150,
    "session_signature": "UNRIPE hardcore-postpunk full-throttle + busy cymbal",
    "structure": [
        {"section":"intro","frame_id":"intro_burst","bars":4},
        {"section":"verse-1","frame_id":"verse_drive","bars":16},
        {"section":"chorus-1","frame_id":"chorus_agro","bars":16},
        {"section":"verse-2","frame_id":"verse_drive","bars":12},
        {"section":"chorus-2","frame_id":"chorus_agro","bars":16},
        {"section":"outro","frame_id":"outro_blast","bars":4}
    ],
    "frames": {
        "intro_burst": kick_4floor(0.86) + hat_16th(0.50) + snare_24(0.80,2),
        "verse_drive": kick_1and3(0.84) + snare_24(0.84,2) + hat_16th(0.48) + [
            {"instrument":"kick","beat":1,"sub":3,"velocity":0.50,"microMs":1,"role":"syncopated"},
            {"instrument":"kick","beat":3,"sub":3,"velocity":0.48,"microMs":1,"role":"syncopated"}
        ],
        "chorus_agro": kick_4floor(0.94) + snare_24(0.92,1) + hat_16th(0.56) + clap_doubling(0.58) + [
            {"instrument":"kick","beat":1,"sub":3,"velocity":0.60,"microMs":1,"role":"double_bass"},
            {"instrument":"kick","beat":3,"sub":3,"velocity":0.58,"microMs":1,"role":"double_bass"}
        ],
        "outro_blast": [
            {"instrument":"kick","beat":0,"sub":0,"velocity":0.96,"microMs":-3,"role":"final"},
            {"instrument":"snare","beat":0,"sub":0,"velocity":0.94,"microMs":2,"role":"final"},
            {"instrument":"crash","beat":0,"sub":0,"velocity":0.82,"microMs":2,"role":"final_crash"},
            {"instrument":"fill","beat":1,"sub":0,"velocity":0.74,"microMs":4,"role":"tom_blast"},
            {"instrument":"fill","beat":1,"sub":2,"velocity":0.78,"microMs":6,"role":"tom_blast"},
            {"instrument":"fill","beat":2,"sub":0,"velocity":0.82,"microMs":4,"role":"tom_blast"},
            {"instrument":"fill","beat":2,"sub":2,"velocity":0.84,"microMs":6,"role":"tom_blast"},
            {"instrument":"kick","beat":3,"sub":0,"velocity":0.96,"microMs":-3,"role":"final_2"},
            {"instrument":"snare","beat":3,"sub":0,"velocity":0.96,"microMs":2,"role":"final_2"},
            {"instrument":"crash","beat":3,"sub":0,"velocity":0.86,"microMs":3,"role":"final_crash_2"}
        ]
    },
    "chord_progression": {
        "intro":    [["Em", 2]],
        "verse-1":  [["Em", 2], ["G", 2], ["D", 2], ["A", 2]],
        "verse-2":  [["Em", 2], ["G", 2], ["D", 2], ["A", 2]],
        "chorus-1": [["C", 2], ["G", 2], ["D", 2], ["Em", 2]],
        "chorus-2": [["C", 2], ["G", 2], ["D", 2], ["Em", 2]],
        "outro":    [["Em", 4]]
    }
}

# ----- 07 Sister -----
songs["sister"] = {
    "title": "Sister", "bpm": 117, "key": "F major", "duration": 281,
    "session_signature": "Sadistic Mika Band warm ballad close + sustained vocal + brush drums",
    "structure": [
        {"section":"intro","frame_id":"intro_warm","bars":8},
        {"section":"verse-1","frame_id":"verse_brush","bars":16},
        {"section":"chorus-1","frame_id":"chorus_swell","bars":16},
        {"section":"verse-2","frame_id":"verse_brush","bars":16},
        {"section":"chorus-2","frame_id":"chorus_swell","bars":16},
        {"section":"bridge","frame_id":"bridge_hush","bars":8},
        {"section":"chorus-3","frame_id":"chorus_climax","bars":16},
        {"section":"outro","frame_id":"outro_fade","bars":8}
    ],
    "frames": {
        "intro_warm": [
            {"instrument":"kick","beat":0,"sub":0,"velocity":0.50,"microMs":-2,"role":"soft_anchor"},
            {"instrument":"kick","beat":2,"sub":0,"velocity":0.46,"microMs":-1,"role":"soft_anchor"},
            {"instrument":"ghost","beat":0,"sub":2,"velocity":0.18,"microMs":14,"role":"brush_sweep"},
            {"instrument":"ghost","beat":1,"sub":2,"velocity":0.16,"microMs":14,"role":"brush_sweep"},
            {"instrument":"ghost","beat":2,"sub":2,"velocity":0.18,"microMs":14,"role":"brush_sweep"},
            {"instrument":"ghost","beat":3,"sub":2,"velocity":0.20,"microMs":14,"role":"brush_sweep"}
        ],
        "verse_brush": kick_1and3(0.62) + brush_softer(0.18) + [
            {"instrument":"hat","beat":0,"sub":0,"velocity":0.24,"microMs":0,"role":"soft_hat"},
            {"instrument":"hat","beat":2,"sub":0,"velocity":0.24,"microMs":0,"role":"soft_hat"}
        ],
        "chorus_swell": kick_1and3(0.74) + snare_24(0.70,8) + hat_8th(0.32) + [
            {"instrument":"crash","beat":0,"sub":0,"velocity":0.32,"microMs":4,"role":"soft_lift"}
        ],
        "bridge_hush": [
            {"instrument":"kick","beat":0,"sub":0,"velocity":0.42,"microMs":-2,"role":"hush"},
            {"instrument":"ghost","beat":1,"sub":2,"velocity":0.16,"microMs":18,"role":"brush_sustain"},
            {"instrument":"ghost","beat":3,"sub":2,"velocity":0.16,"microMs":18,"role":"brush_sustain"}
        ],
        "chorus_climax": kick_1and3(0.82) + snare_24(0.80,6) + hat_8th(0.40) + [
            {"instrument":"fill","beat":3,"sub":2,"velocity":0.42,"microMs":10,"role":"soft_tom"},
            {"instrument":"crash","beat":0,"sub":0,"velocity":0.46,"microMs":4,"role":"swell_lift"}
        ],
        "outro_fade": [
            {"instrument":"kick","beat":0,"sub":0,"velocity":0.46,"microMs":-2,"role":"fade_anchor"},
            {"instrument":"crash","beat":0,"sub":0,"velocity":0.36,"microMs":4,"role":"long_ring"},
            {"instrument":"ghost","beat":1,"sub":2,"velocity":0.12,"microMs":18,"role":"final_brush"},
            {"instrument":"ghost","beat":3,"sub":2,"velocity":0.10,"microMs":18,"role":"final_brush"}
        ]
    },
    "chord_progression": {
        "intro":    [["F", 4]],
        "verse-1":  [["F", 4], ["Dm", 4], ["Bb", 4], ["C", 4]],
        "verse-2":  [["F", 4], ["Dm", 4], ["Bb", 4], ["C", 4]],
        "chorus-1": [["Bb", 2], ["C", 2], ["F", 2], ["Dm", 2]],
        "chorus-2": [["Bb", 2], ["C", 2], ["F", 2], ["Dm", 2]],
        "chorus-3": [["Bb", 2], ["C", 2], ["F", 2], ["Dm", 2]],
        "bridge":   [["Gm", 4], ["C", 4]],
        "outro":    [["F", 8]]
    }
}

session_role_map = {
    "intro_drive":"intro", "chant_drive":"comp", "chant_release":"recap", "outro_punch":"outro",
    "intro_pulse":"intro", "verse_groove":"verse", "chorus_hook":"recap", "bridge_drop":"break",
    "chorus_climax":"recap", "outro_hit":"outro",
    "intro_quiet":"intro", "verse_quiet":"verse", "chorus_loud":"recap", "bridge_jam":"break",
    "outro_ringout":"outro",
    "intro_skank":"intro", "verse_skank":"verse", "chorus_drive":"recap", "bridge_break":"break",
    "intro_burst":"intro", "verse_drive":"verse", "chorus_agro":"recap", "outro_blast":"outro",
    "intro_warm":"intro", "verse_brush":"verse", "chorus_swell":"recap", "bridge_hush":"break",
    "outro_fade":"outro"
}

INST_ORDER = {"kick":0,"snare":1,"hat":2,"ghost":3,"fill":4,"crash":5}

total = 0
for song_id, data in songs.items():
    total_bars = sum(s["bars"] for s in data["structure"])
    est_dur = int(total_bars * 60 / data["bpm"] * 4)
    out = {
        "version": 1,
        "format": "song-track",
        "song_id": f"tabasco-{song_id}",
        "song_title": data["title"],
        "band": "air rock connect box",
        "original_album": "Tabasco. LIVE (2005-ish)",
        "session_signature": data["session_signature"],
        "bpm": data["bpm"],
        "key": data["key"],
        "structure": data["structure"],
        "total_bars": total_bars,
        "estimated_duration_s": est_dur,
        "frames": [],
        "chord_progression": data["chord_progression"]
    }
    for frame_id, events in data["frames"].items():
        evt_sorted = sorted(events, key=lambda e: (e["beat"], e["sub"], INST_ORDER.get(e["instrument"], 9)))
        out["frames"].append({
            "id": frame_id,
            "session_role": session_role_map.get(frame_id, "verse"),
            "barLength": 4,
            "events": evt_sorted
        })
    path = f"presets/drum-frames-tabasco-{song_id}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print(f"OK  {path}  {total_bars} bars / {est_dur}s / {len(out['frames'])} frames")
    total += 1

print(f"\nDone: {total} song JSONs generated")
