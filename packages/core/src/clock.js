import {requireValue} from './errors.js';
/** Anchored time, never accumulated frame deltas. Inject now() for deterministic tests. */
export class TimelineClock {
  constructor(now){
    requireValue(typeof now==='function','CLOCK_INVALID','A monotonic clock is required.');
    this.now=now;this.time=0;this.rate=1;this.running=false;this.lastNow=-Infinity;this.wall=this.readWall();
  }
  readWall(){const value=this.now();requireValue(Number.isFinite(value)&&value>=this.lastNow,'CLOCK_INVALID','Clock must be finite and monotonic.');this.lastNow=value;return value;}
  read(){const now=this.readWall();return this.time+(this.running?(now-this.wall)*this.rate:0);}
  setTime(time){requireValue(Number.isFinite(time)&&time>=0,'INVALID_TIME','Time must be finite and nonnegative.');this.wall=this.readWall();this.time=time;}
  start(){this.setTime(this.read());this.running=true;}
  pause(){this.setTime(this.read());this.running=false;}
  setRate(rate){requireValue(Number.isFinite(rate)&&rate>=.25&&rate<=4,'INVALID_RATE','Playback rate must be between 0.25 and 4.');this.setTime(this.read());this.rate=rate;}
  setScene(){this.pause();this.setTime(0);}
  destroy(){this.running=false;}
}
