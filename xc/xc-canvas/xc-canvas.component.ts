/*
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 * Copyright 2023 Xyna GmbH, Germany
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, inject } from '@angular/core';

import { Observable, Subject, Subscription } from 'rxjs';

import { coerceBoolean, isNumber, timeString } from '../../base';
import { CanvasHelperRecording, MouseEventType, ScreenInfo, XcCanvasHelper, XcCanvasMouseEventsOption } from './xc-canvas-helper.class';


interface ResizeObserverEntry {
    readonly target: Element;
    readonly contentRect: DOMRectReadOnly;
    readonly borderBoxSize?: Array<number>;
    readonly contentBoxSize?: Array<number>;
    readonly devicePixelContentBoxSize?: Array<number>;
}

/**
 * https://caniuse.com/#feat=resizeobserver
 */
declare class ResizeObserver {
    constructor(callback: (entries: ResizeObserverEntry[]) => void);
    /**
     * Unobserves all observed Element targets of a particular observer.
     */
    disconnect: (element: Element) => void;
    /**
     * Initiates the observing of a specified Element.
     * default options = {box: 'content-box'}
     */
    observe: (element: Element, options?: ResizeObserverOptions) => void;
    /**
     * Ends the observing of a specified Element.
     */
    unobserve: (element: Element) => void;
}

export interface XcCanvasController {

    /**
     * Function, which will be called in every frame. Object states, movable objects or (background) processes
     * should be handled in here.
     * For example: Finding out the position of the pool and calculate the new position of a player
     */
    step?: (deltaTimestamp: number) => void;

    /**
     * Browsers usually keeps framerate at 60 so the step function will be called 60 times per second. This variable helps to limit it
     * 0 -> never process it
     * 1 -> process it as every time (default)
     * 2+ -> skips it until x frames from the last is reached
     */
    stepEveryXFrame?: number;

    /**
     * Function, which will be called in every frame and has the current keyboard event and a set of all keys
     * pressed by the user in this frame. (Note: Canvas needs the focus)
     */
    keyboardInput?: (deltaTimestamp: number, keyboardEvent: KeyboardEvent, keys: Set<string>) => void;

    /**
     * Browsers usually keeps framerate at 60 so the keyboardInput function will be called 60 times per second. This variable helps to limit it
     * 0 -> never process it
     * 1 -> process it as every time (default)
     * 2+ -> skips it until x frames from the last is reached
     */
    keyboardInputEveryXFrame?: number;

    /**
     * Function, which will be called in every frame. Animations, movable objects or (background) processes
     * should be handled in here
     */
    draw?: (c: CanvasRenderingContext2D, deltaTimestamp: number) => void;

    /**
     * Browsers usually keeps framerate at 60 so the draw function will be called 60 times per second. This variable helps to limit it
     * 0 -> never process it
     * 1 -> process it as every time (default)
     * 2+ -> skips it until x frames from the last is reached
     */
    drawEveryXFrame?: number;
}

export interface XcCanvasObserver {

    keydown?: (event: KeyboardEvent) => void;

    keyup?: (event: KeyboardEvent) => void;

    mouse?: (event: MouseEvent) => void;

    wheel?: (event: WheelEvent) => void;

    fit?: (parent: HTMLElement) => void;

    resize?: () => void;
}


@Component({
    selector: 'xc-canvas',
    templateUrl: './xc-canvas.component.html',
    styleUrls: ['./xc-canvas.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class XcCanvasComponent implements OnInit, OnDestroy {
    protected elementRef = inject(ElementRef);
    protected zone = inject(NgZone);
    protected cdr = inject(ChangeDetectorRef);


    private static _num = 0;
    private readonly _uid = 'xc_canvas_with_unique_num' + ++XcCanvasComponent._num;
    private readonly _keyCodeSet = new Set<string>();
    private readonly _oldDimensions = { width: 0, height: 0 };
    private _frameCount = 0;
    private readonly _oldParentSize = { width: -1, height: -1 };

    private _lastTimestamp: number;
    private _lastStepTimestamp: number;
    private _lastDrawTimestamp: number;
    private _lastKeyboardInputTimestamp: number;

    private _parent: HTMLElement;
    private _canvasRecording: CanvasHelperRecording;

    private resizeObserver: ResizeObserver;

    private readonly _initializedChangeSubject = new Subject<boolean>();
    private _initialized = false;
    private _initializedChangeSubscription: Subscription;
    private _running = false;
    private _animationFrameRequestId: number;
    private _fps: number;
    private _canvas: HTMLCanvasElement;
    private _context: CanvasRenderingContext2D;
    private _fittingToParent = false;
    private _resizeObserverFallback = false;

    private _keyboardEvent: KeyboardEvent;
    private keyboardEventSetter: (e: KeyboardEvent) => void;
    private mouseEventHandler: (e: MouseEvent) => void;
    private eventKiller: (event: Event) => void;

    get initialized(): boolean {
        return this._initialized;
    }

    set initialized(value: boolean) {
        this._initialized = value;
        this._initializedChangeSubject.next(value);
    }

    get initializedChange(): Observable<boolean> {
        return this._initializedChangeSubject.asObservable();
    }

    get running(): boolean {
        return this._running;
    }

    get fps(): number {
        return this._fps;
    }

    get canvas(): HTMLCanvasElement {
        return this._canvas;
    }

    get context(): CanvasRenderingContext2D {
        return this._context;
    }

    @Input('xc-canvas-controller')
    controller: XcCanvasController = {};


    @Input('xc-canvas-observer')
    observer: XcCanvasObserver = {};


    @Input('xc-canvas-mouseeventsoption')
    mouseEventsOption: XcCanvasMouseEventsOption = {
        eventsListenTo: Object.keys(MouseEventType).map<MouseEventType>(key => MouseEventType[key])
    };


    @Input({alias: 'xc-canvas-fitting', transform: coerceBoolean})
    set fitting(value: boolean) {
        this._fittingToParent = value;
    }

    /**
     * Is triggerd if the canvas is resized.
     */
    @Output()
    readonly resizeChange = new EventEmitter<ScreenInfo>(false);


    @Output()
    readonly parentSizeChange = new EventEmitter<ScreenInfo>(false);


    get width(): number {
        return this.canvas.width;
    }

    get height(): number {
        return this.canvas.height;
    }

    get aspect(): number {
        return this.width / this.height;
    }

    ngOnInit() {

        this._canvas = (this.elementRef.nativeElement as HTMLElement).children[0] as HTMLCanvasElement;
        this._canvas.setAttribute('id', this._uid);
        this._canvas.setAttribute('tabindex', '0');
        this._oldDimensions.width = this._canvas.width;
        this._oldDimensions.height = this._canvas.height;
        // it seems that the parent must not be an Angular component because if it is the fitting does not work correctly
        // hence a more dynamic approach is needed - @todo TODO
        this._parent = (this.elementRef.nativeElement as HTMLElement).parentElement;

        // Check if Browser supports ResizeObserver. It looks really good that it does
        // https://caniuse.com/#feat=resizeobserver
        this._resizeObserverFallback = !ResizeObserver;

        if (!this._resizeObserverFallback) {
            this.resizeObserver = new ResizeObserver(() => {
                if (this._fittingToParent) {
                    this.resizeToParent();
                }
            });
        }

        this._context = this._canvas.getContext('2d');

        this.registerAllListener();

        this.initialized = true;

    }

    ngOnDestroy() {
        this.unregisterAllListener();
        this.endLoop();
    }

    startLoop() {
        this._frameCount = 0;

        this.zone.runOutsideAngular(
            () => {

                const loop = (currentTimestamp: number) => {

                    this.frame(currentTimestamp);

                    this._animationFrameRequestId = window.requestAnimationFrame(loop);
                };

                if (this.initialized) {
                    if (!this.running) {
                        this._animationFrameRequestId = window.requestAnimationFrame(loop);
                        this._running = true;
                    }
                    if (this._initializedChangeSubscription) {
                        this._initializedChangeSubscription.unsubscribe();
                    }
                } else {
                    console.warn('the canvas is not initialized yet. The component will start when it is.');
                    this._initializedChangeSubscription = this.initializedChange.subscribe(res => {
                        if (res) {
                            console.log('The component is starting now');
                            this.startLoop();
                        }
                    });
                }


            }
        );

    }

    private frame(currentTimestamp?: number) {
        this._frameCount++;
        currentTimestamp = currentTimestamp || Date.now();

        let processInFrame = true;
        let deltaTimestamp = 0;
        this._fps = 0;
        if (this._lastTimestamp) {
            deltaTimestamp = currentTimestamp - this._lastTimestamp;
            this._fps = 1000 / deltaTimestamp;
        }

        this._lastTimestamp = currentTimestamp;

        if (this._fittingToParent && this._resizeObserverFallback) {
            this.checkParent();
        }

        processInFrame = !isNumber(this.controller.keyboardInputEveryXFrame)
            || (this.controller.keyboardInputEveryXFrame && this._frameCount % this.controller.keyboardInputEveryXFrame === 0);
        if (this.controller.keyboardInput && processInFrame) {
            deltaTimestamp = this._lastKeyboardInputTimestamp ? currentTimestamp - this._lastKeyboardInputTimestamp : 0;
            this.controller.keyboardInput(deltaTimestamp, this._keyboardEvent, this._keyCodeSet);
            this._lastKeyboardInputTimestamp = currentTimestamp;
        }


        processInFrame = !isNumber(this.controller.stepEveryXFrame)
            || (this.controller.stepEveryXFrame && this._frameCount % this.controller.stepEveryXFrame === 0);
        if (this.controller.step && processInFrame) {
            deltaTimestamp = this._lastStepTimestamp ? currentTimestamp - this._lastStepTimestamp : 0;
            this.controller.step(deltaTimestamp);
            this._lastStepTimestamp = currentTimestamp;
        }

        processInFrame = !isNumber(this.controller.drawEveryXFrame)
            || (this.controller.drawEveryXFrame && this._frameCount % this.controller.drawEveryXFrame === 0);
        if (this.controller.draw && processInFrame) {
            deltaTimestamp = this._lastDrawTimestamp ? currentTimestamp - this._lastDrawTimestamp : 0;
            this.controller.draw(this.context, deltaTimestamp);
            this._lastDrawTimestamp = currentTimestamp;
        }

    }

    private checkParent() {
        if (this._parent && this.initialized) {
            const rect = this.getParentFitSize();
            if (rect.width !== this._oldParentSize.width || rect.height !== this._oldParentSize.height) {
                this.resizeToParent();
                this._oldParentSize.width = rect.width;
                this._oldParentSize.height = rect.height;
                this.parentSizeChange.next(<ScreenInfo>{
                    width: rect.width,
                    height: rect.height,
                    aspect: rect.width / rect.height
                });
            }
        }
    }

    private getParentFitSize(): { width: number; height: number } {
        const rect = this._parent.getBoundingClientRect();
        const cStyles = window.getComputedStyle(this._parent);
        const hbord = parseFloat(cStyles.borderLeftWidth || '0') + parseFloat(cStyles.borderRightWidth || '0');
        const vbord = parseFloat(cStyles.borderTopWidth || '0') + parseFloat(cStyles.borderBottomWidth || '0');
        const hpad = parseFloat(cStyles.paddingLeft || '0') + parseFloat(cStyles.paddingRight || '0');
        const vpad = parseFloat(cStyles.paddingTop || '0') + parseFloat(cStyles.paddingBottom || '0');
        const width = rect.width - hpad - hbord;
        const height = rect.height - vpad - vbord;
        return { width, height };
    }

    endLoop() {
        if (this._animationFrameRequestId) {
            window.cancelAnimationFrame(this._animationFrameRequestId);
        }

        this._running = false;
        this._fps = 0;
    }


    resize(width: number, height: number) {
        if (height > 0 && width >= 0) {
            this.canvas.width = width;
            this.canvas.height = height;
            if (this.observer.resize) {
                this.observer.resize();
            }
        }
    }

    resizeToParent() {
        const rect = this.getParentFitSize();
        this.resize(rect.width, rect.height);
        if (this.observer.fit) {
            this.observer.fit(this._parent);
        }
    }

    /**
     * request the canvas to activate it in fullscreen.
     * Event needs to be trustworthy. Needs to be created by a user like an actual mouseclick or keydown
     * It returns two observable, which tells the programm if it enters fullscreen mode
     * and when it leaves.
     * TODO: Could be merged into one observable
     */
    eventToFullscreen(e: Event): {
        whenLeft: Observable<ScreenInfo>;
        whenEntered: Observable<ScreenInfo>;
    } {

        const fullscreenLeftSubject = new Subject<ScreenInfo>();
        const fullscreenOpenedSubject = new Subject<ScreenInfo>();

        const opt: FullscreenOptions = {
            navigationUI: 'show'
        };

        const fullscreenErrorFunc = () => {
            const errorStr = 'Event not trustworthy - Can\'t request Fullscreen';
            console.warn(errorStr);
            fullscreenLeftSubject.error(errorStr);
            fullscreenLeftSubject.complete();
            fullscreenOpenedSubject.error(errorStr);
            fullscreenOpenedSubject.complete();
        };

        const old = new ScreenInfo(this.canvas.width, this.canvas.height);
        const newSI = new ScreenInfo(this.canvas.width, this.canvas.height);

        if (e.isTrusted) {

            const fullscrTestFunc = (ev: Event) => {
                if (!document.fullscreenElement) {
                    this.canvas.removeEventListener('fullscreenchange', fullscrTestFunc);
                    if (this.canvas) {
                        this.resize(old.width, old.height);
                    }
                    fullscreenLeftSubject.next(old);
                    fullscreenLeftSubject.complete();
                } else {
                    fullscreenOpenedSubject.next(newSI);
                    fullscreenOpenedSubject.complete();
                }
            };

            this.canvas.addEventListener('fullscreenchange', fullscrTestFunc);
            this.canvas.requestFullscreen(opt)
                .then(() => {
                    if (this.canvas) {
                        newSI.width = window.innerWidth;
                        newSI.height = window.innerHeight;
                        this.resize(newSI.width, newSI.height);
                    }
                }).catch(() => {
                    fullscreenErrorFunc();
                });
        } else {
            fullscreenErrorFunc();
        }

        return {
            whenLeft: fullscreenLeftSubject.asObservable(),
            whenEntered: fullscreenOpenedSubject.asObservable()
        };
    }

    /**
     * request the browser to activate a pointerlock.
     * Event needs to be trustworthy. Needs to be created by a user like an actual mouseclick or keydown
     * It returns two observable, which tells the programm if it enters the pointer lock
     * and when it leaves.
     * TODO: Could be merged into one observable
     */
    eventToPointerLock(e: Event): {
        whenUnlocked: Observable<void>;
        whenLocked: Observable<void>;
    } {

        const pointerLockedSubject = new Subject<void>();
        const pointerUnlockedSubject = new Subject<void>();

        const lockErrFunc = () => {
            const errMsg = 'pointer lock error';
            console.warn(errMsg);
            pointerUnlockedSubject.error(errMsg);
            pointerUnlockedSubject.complete();
            pointerLockedSubject.error(errMsg);
            pointerLockedSubject.complete();
        };

        if (e.isTrusted) {

            const lockedTestFunc = (ev: Event) => {
                document.removeEventListener('pointerlockerror', lockErrFunc);

                if (!document.pointerLockElement) {
                    document.removeEventListener('pointerlockchange', lockedTestFunc);
                    pointerUnlockedSubject.next();
                    pointerUnlockedSubject.complete();
                } else {
                    pointerLockedSubject.next();
                    pointerLockedSubject.complete();
                    // after locking the cursor - focusing per mouse click is not possible anymore
                    this.focus();
                }
            };

            document.addEventListener('pointerlockerror', lockErrFunc, false);
            document.addEventListener('pointerlockchange', lockedTestFunc);

            this.canvas.requestPointerLock().catch(lockErrFunc);
        } else {
            lockErrFunc();
        }

        return {
            whenUnlocked: pointerUnlockedSubject.asObservable(),
            whenLocked: pointerLockedSubject.asObservable()
        };
    }

    focus() {
        this.canvas.focus();
    }

    private registerAllListener() {
        this.zone.runOutsideAngular(() => {

            this.keyboardEventSetter = (e: KeyboardEvent) => {
                this._keyboardEvent = e;
                this._keyCodeSet.add(e.code).add(e.key);

                if (e.type === 'keydown' && this.observer.keydown) {
                    this.observer.keydown(e);
                }

                e.preventDefault();
                e.stopPropagation();
            };

            this.mouseEventHandler = (e: Event) => {

                if (e.type !== MouseEventType.wheel && this.observer.mouse) {
                    this.observer.mouse(e as MouseEvent);

                    if (e.type === MouseEventType.contextmenu) {
                        e.preventDefault();
                    }
                }

                if (e.type === MouseEventType.wheel && this.observer.mouse) {
                    this.observer.wheel(e as WheelEvent);
                }

            };

            this.eventKiller = (event: Event) => {

                const killAllEvents = (e: Event) => {
                    this._keyboardEvent = null;
                    this._keyCodeSet.clear();
                    document.exitPointerLock();
                    if (document.fullscreenElement) {
                        void document.exitFullscreen();
                    }
                };
                if (event.type === 'visibilitychange' && document.hidden) {
                    killAllEvents(event);
                }
                if (event.type === 'blur') {
                    killAllEvents(event);
                }

                if (event instanceof KeyboardEvent) {
                    this._keyboardEvent = null;
                    this._keyCodeSet.delete(event.key);
                    this._keyCodeSet.delete(event.code);
                    if (event.type === 'keyup' && this.observer.keyup) {
                        this.observer.keyup(event);
                    }
                }
            };

            this.canvas.addEventListener('keydown', this.keyboardEventSetter);
            this.mouseEventsOption.eventsListenTo.forEach(key => {
                this.canvas.addEventListener(MouseEventType[key], this.mouseEventHandler);
            });
            document.addEventListener('visibilitychange', this.eventKiller);
            window.addEventListener('blur', this.eventKiller);
            this.canvas.addEventListener('blur', this.eventKiller);
            this.canvas.addEventListener('keyup', this.eventKiller);

            if (!this._resizeObserverFallback) {
                this.resizeObserver.observe(this._parent);
            }
        });
    }

    private unregisterAllListener() {

        this.canvas.removeEventListener('keydown', this.keyboardEventSetter);
        this.canvas.removeEventListener('keyup', this.eventKiller);
        Object.keys(MouseEventType).forEach(key => {
            this.canvas.removeEventListener(MouseEventType[key], this.mouseEventHandler);
        });
        document.removeEventListener('visibilitychange', this.eventKiller);
        window.removeEventListener('blur', this.eventKiller);
        this.canvas.removeEventListener('blur', this.eventKiller);
        this.canvas.removeEventListener('keyup', this.eventKiller);
        if (!this._resizeObserverFallback) {
            this.resizeObserver.unobserve(this._parent);
        }
    }

    /**
     * If the parent is a non-standard html element (like XcPlotComponent, XcCanvasComponent)
     * then the method "checkParent()" (or to be more preceise: "_parent.getBoundingClientRect()")
     * does not work properly and does not detect when the parent's height gets smaller.
     * Invalidating the canvas element helps.
     */
    invalidateCanvasElementAndForceBrowserInternalRepaint() {
        const old = this.canvas.style.display || 'flex';
        this.canvas.style.display = 'none';
        window.requestAnimationFrame(() => this.canvas.style.display = old);
    }


    downloadScreenshot() {
        const screenshot = XcCanvasHelper.createScreenshot(this.canvas);
        const filename = 'screenshot_' + timeString(screenshot.timestamp, 'hh:mm:ss:msec');
        XcCanvasHelper.downloadScreenshot(screenshot, filename);
    }

    printScreenshot() {
        const screenshot = XcCanvasHelper.createScreenshot(this.canvas);
        XcCanvasHelper.printScreenshot(screenshot);
    }

    startRecording() {
        if (!this._canvasRecording) {
            this._canvasRecording = XcCanvasHelper.startRecording(this.canvas);
        } else if (this._canvasRecording.recording) {
            this.stopRecording();
        }
    }

    stopRecording() {
        if (this._canvasRecording.recording) {
            this._canvasRecording.stop();
        }
    }

    downloadRecording() {
        XcCanvasHelper.downloadRecording(this._canvasRecording);
    }

}
