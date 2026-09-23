const { EventEmitter } = require('events');

class Duplex extends EventEmitter {
  constructor() {
    super();
    this.readable = true;
    this.writable = true;
  }
  pipe() {
    return this;
  }
  write() {
    return true;
  }
  end() {
    this.emit('end');
  }
  destroy() {
    this.emit('close');
  }
}

class Readable extends Duplex {}
class Writable extends Duplex {}
class Transform extends Duplex {}
class PassThrough extends Duplex {}

module.exports = {
  Duplex,
  Readable,
  Writable,
  Transform,
  PassThrough,
  Stream: Duplex,
  pipeline: (...args) => {
    const cb = args[args.length - 1];
    if (typeof cb === 'function') cb(null);
  },
  finished: () => {},
};
