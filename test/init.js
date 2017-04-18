const Test = require('tape/lib/test');
require('babel-register');

/**
 * Monkeypatch support for returning Promises from Tape tests. Mostly just
 * copied some code from Tape.
 */

Test.prototype.run = function run() {
  if (this._skip) {
    this.comment(`SKIP ${this.name}`);
  }
  if (!this._cb || this._skip) {
    return this._end();
  }
  if (this._timeout != null) {
    this.timeoutAfter(this._timeout);
  }
  this.emit('prerun');

  // Start custom code
  const result = this._cb(this);
  if (result && result.then) {
    result.catch(
      (err) => {
        if (err) {
          this.error(err);
        } else {
          this.fail(err);
        }
      }
    );
  }
  // End custom code

  this.emit('run');
};
