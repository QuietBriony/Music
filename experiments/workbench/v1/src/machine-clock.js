// One Strudel scheduler supplies both note events and the machine's 16 steps.
// No interval, second clock, code rewriting, or default audio for these pulses.
export function connectMachineClock(scheduler, { stack, pure }, machine, onStop = () => {}) {
  const setPattern = scheduler.setPattern;
  const onToggle = scheduler.onToggle;
  const originals = new WeakMap();
  let attached = true;
  const pulse = pure(0).fast(16).onTrigger((hap, _now, cps, time) => {
    if (!attached) return;
    const step = ((Math.round(Number(hap.whole.begin) * 16) % 16) + 16) % 16;
    machine.tick(time, step, cps);
  }, true);
  function wrap(pattern) {
    const original = originals.get(pattern) || pattern;
    const combined = stack(original, pulse);
    // The LIVE shadow controller stamps input at the scheduler's cycle.
    if (original.shadowInput) combined.shadowInput = original.shadowInput.bind(original);
    originals.set(combined, original);
    return combined;
  }
  scheduler.setPattern = function(pattern, ...args) {
    return setPattern.call(this, wrap(pattern), ...args);
  };
  scheduler.onToggle = function(started) {
    onToggle?.call(this, started);
    if (!started) { machine.stop(); onStop(); }
  };
  return {
    disconnect() {
      if (!attached) return;
      attached = false;
      machine.stop();
      scheduler.setPattern = setPattern;
      scheduler.onToggle = onToggle;
      scheduler.pattern = originals.get(scheduler.pattern) || scheduler.pattern;
    },
  };
}
