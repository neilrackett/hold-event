/*!
 * hold-event
 * https://github.com/yomotsu/hold-event
 * (c) 2020 @yomotsu
 * Released under the MIT License.
 */
var HOLD_EVENT_TYPE;
(function (HOLD_EVENT_TYPE) {
    HOLD_EVENT_TYPE["HOLD_START"] = "holdStart";
    HOLD_EVENT_TYPE["HOLD_END"] = "holdEnd";
    HOLD_EVENT_TYPE["HOLDING"] = "holding";
})(HOLD_EVENT_TYPE || (HOLD_EVENT_TYPE = {}));

class EventDispatcher {
    constructor() {
        this._listeners = {};
    }
    addEventListener(type, listener) {
        const listeners = this._listeners;
        if (listeners[type] === undefined)
            listeners[type] = [];
        if (listeners[type].indexOf(listener) === -1)
            listeners[type].push(listener);
    }
    removeEventListener(type, listener) {
        const listeners = this._listeners;
        const listenerArray = listeners[type];
        if (listenerArray !== undefined) {
            const index = listenerArray.indexOf(listener);
            if (index !== -1)
                listenerArray.splice(index, 1);
        }
    }
    dispatchEvent(event) {
        const listeners = this._listeners;
        const listenerArray = listeners[event.type];
        if (listenerArray !== undefined) {
            event.target = this;
            const array = listenerArray.slice(0);
            for (let i = 0, l = array.length; i < l; i++) {
                array[i].call(this, event);
            }
        }
    }
}

class Hold extends EventDispatcher {
    constructor(holdIntervalDelay) {
        super();
        this._enabled = true;
        this._holding = false;
        this._intervalId = -1;
        this._deltaTime = 0;
        this._elapsedTime = 0;
        this._lastTime = 0;
        this._holdStart = (event) => {
            if (!this._enabled)
                return;
            if (this._holding)
                return;
            this._deltaTime = 0;
            this._elapsedTime = 0;
            this._lastTime = performance.now();
            this.dispatchEvent({
                type: HOLD_EVENT_TYPE.HOLD_START,
                deltaTime: this._deltaTime,
                elapsedTime: this._elapsedTime,
                originalEvent: event,
            });
            this._holding = true;
            const cb = () => {
                this._intervalId = !!this.holdIntervalDelay ?
                    window.setTimeout(cb, this.holdIntervalDelay) :
                    window.requestAnimationFrame(cb);
                const now = performance.now();
                this._deltaTime = now - this._lastTime;
                this._elapsedTime += this._deltaTime;
                this._lastTime = performance.now();
                this.dispatchEvent({
                    type: HOLD_EVENT_TYPE.HOLDING,
                    deltaTime: this._deltaTime,
                    elapsedTime: this._elapsedTime,
                    originalEvent: event
                });
            };
            this._intervalId = !!this.holdIntervalDelay ?
                window.setTimeout(cb, this.holdIntervalDelay) :
                window.requestAnimationFrame(cb);
        };
        this._holdEnd = (event) => {
            if (!this._enabled)
                return;
            if (!this._holding)
                return;
            const now = performance.now();
            this._deltaTime = now - this._lastTime;
            this._elapsedTime += this._deltaTime;
            this._lastTime = performance.now();
            this.dispatchEvent({
                type: HOLD_EVENT_TYPE.HOLD_END,
                deltaTime: this._deltaTime,
                elapsedTime: this._elapsedTime,
                originalEvent: event,
            });
            window.clearTimeout(this._intervalId);
            window.cancelAnimationFrame(this._intervalId);
            this._holding = false;
        };
        this.holdIntervalDelay = holdIntervalDelay;
    }
    get enabled() {
        return this._enabled;
    }
    set enabled(enabled) {
        if (this._enabled === enabled)
            return;
        this._enabled = enabled;
        if (!this._enabled)
            this._holdEnd();
    }
    get holding() {
        return this._holding;
    }
}

class ElementHold extends Hold {
    constructor(element, holdIntervalDelay) {
        super(holdIntervalDelay);
        this._activePointerIds = [];
        const holdStart = (event) => {
            this._holdStart(event);
        };
        const holdEnd = (event) => {
            this._activePointerIds.length = 0;
            this._holdEnd(event);
        };
        const onPointerDown = (event) => {
            this._activePointerIds.push(event.pointerId);
            holdStart(event);
        };
        const onPointerUp = (event) => {
            const pointerIndex = this._activePointerIds.indexOf(event.pointerId);
            if (pointerIndex === -1)
                return;
            this._activePointerIds.splice(pointerIndex, 1);
            if (this._activePointerIds.length === 0)
                holdEnd(event);
        };
        element.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('pointerup', onPointerUp);
        window.addEventListener('blur', holdEnd);
    }
}

class KeyboardKeyHold extends Hold {
    constructor(code, holdIntervalDelay) {
        if (typeof code !== 'string') {
            console.error('KeyboardKeyHold: the first argument has to be a KeyboardEvent.code string.');
            return;
        }
        super(holdIntervalDelay);
        this._holdStart = this._holdStart.bind(this);
        this._holdEnd = this._holdEnd.bind(this);
        const onKeydown = (event) => {
            if (isInputEvent(event))
                return;
            if (event.code !== code)
                return;
            this._holdStart(event);
        };
        const onKeyup = (event) => {
            if (event.code !== code)
                return;
            this._holdEnd(event);
        };
        document.addEventListener('keydown', onKeydown);
        document.addEventListener('keyup', onKeyup);
        window.addEventListener('blur', this._holdEnd);
    }
}
function isInputEvent(event) {
    const target = event.target;
    return (target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable);
}

export { ElementHold, HOLD_EVENT_TYPE, KeyboardKeyHold };
