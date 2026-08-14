import { useEffect, useState } from "react";

export type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
  finished: boolean;
};

function compute(target: Date): Countdown {
  const total = Math.max(0, target.getTime() - Date.now());
  const s = Math.floor(total / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    total,
    finished: total <= 0,
  };
}

export function useCountdown(target: Date): Countdown {
  const [state, setState] = useState<Countdown>(() => compute(target));

  useEffect(() => {
    setState(compute(target));
    const id = setInterval(() => setState(compute(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  return state;
}
