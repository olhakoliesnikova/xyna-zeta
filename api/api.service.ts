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
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { XoEncryptionData } from '@zeta/api/xo/encryption-data.model';

import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { catchError, filter, finalize, map, shareReplay, tap } from 'rxjs/operators';

import { getSubdirectory, isNumber, pack, stringToUnboxedInteger } from '../base';
import { XoKillOrdersResponse } from './xo/kill-orders-response.model';
import { XoOrderIdArray } from './xo/order-id.model';
import { XoXPRCApplication as XoApplication, XoXPRCWorkspace as XoWorkspace } from './xo/runtime-context.model';
import { StartOrderResult, XoStartOrderResponse } from './xo/start-order-response.model';
import { XoStartOrderSuccessResponse } from './xo/start-order-success-response.model';
import { FullQualifiedName, RuntimeContext, XoDescriber, XoDescriberString } from './xo/xo-describer';
import { XoManagedFileID } from './xo/xo-managed-file-id';
import { Xo, XoArray, XoArrayClassInterface, XoClassInterface, XoClassInterfaceFrom, XoDerivedClassInterfaceFrom, XoJson, XoObject } from './xo/xo-object';
import { XoRuntimeContext, XoRuntimeContextArray } from './xo/xo-runtime-context';
import { XoStructureObject, XoStructureType } from './xo/xo-structure';
import { ConfigService } from './config.service';


export type XynaMonitoringLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;
export type XynaPriority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;


export type CacheData<T> = Subject<T> | T;
export class CachedObject<T> {
    constructor(public data: CacheData<T>, public timestamp: number) {
    }
}

export class XoDescriberCache<T = any> {
    private readonly cache = new Map<string, CachedObject<T>>();

    /**
     * Lifetime in ms, an object stays inside the cache (default: Unlimited).
     *
     * The counter starts when the subject's value is set and not on writing the subject inside the cache
     */
    private _lifetime: number;


    constructor(lifetime = Number.MAX_VALUE) {
        this.lifetime = lifetime;
    }

    get(rtc: RuntimeContext, describers: XoDescriber[]): Map<XoDescriber, CacheData<T>> {
        const result = new Map<XoDescriber, CacheData<T>>();
        const now = Date.now();

        describers.forEach(describer => {
            let key: string, value: CachedObject<T>;
            if ((key = XoDescriberString(describer, rtc)) && (value = this.cache.get(key))) {
                if (now - value.timestamp < this.lifetime) {
                    result.set(describer, value.data);
                } else {
                    // delete from cache when lifetime is over
                    this.cache.delete(key);
                }
            }
        });
        return result;
    }

    set(rtc: RuntimeContext, describer: XoDescriber, value: CacheData<T>) {
        // set timestamp as soon as subject got its value. Until then, subject is always up to date (and won't be deleted from cache)
        const cachedObject = new CachedObject(value, value instanceof Subject ? Number.MAX_VALUE : Date.now());
        this.cache.set(XoDescriberString(describer, rtc), cachedObject);
    }

    clear() {
        this.cache.clear();
    }

    get lifetime(): number {
        return this._lifetime;
    }

    set lifetime(value: number) {
        this._lifetime = value;
    }
}


export interface Options {
    withErrorMessage?: boolean;
}


export class OptionsBuilder<T extends Options> {

    constructor(protected readonly _options: T = <T>{}) {
    }

    get options(): T {
        return this._options;
    }

    // non payload specific

    withErrorMessage(value: boolean): this {
        this._options.withErrorMessage = value;
        return this;
    }
}


export interface StartOrderOptions extends Options {
    async: boolean;
    inputSourceId?: number;
    customStringContainer?: string[];
    monitoringLevel?: XynaMonitoringLevel;
    priority?: XynaPriority;
}


export class StartOrderOptionsBuilder extends OptionsBuilder<StartOrderOptions> {

    static get defaultOptions(): StartOrderOptions {
        return { async: false };
    }

    static get defaultOptionsWithErrorMessage(): StartOrderOptions {
        return { async: false, withErrorMessage: true };
    }

    constructor(_options: StartOrderOptions = StartOrderOptionsBuilder.defaultOptions) {
        super(_options);
    }

    async(value: boolean): this {
        this._options.async = value;
        return this;
    }

    inputSourceId(value: number): this {
        this._options.inputSourceId = value;
        return this;
    }

    customStringContainer(value: string[]): this {
        this._options.customStringContainer = value;
        return this;
    }

    monitoringLevel(value: XynaMonitoringLevel): this {
        this._options.monitoringLevel = value;
        return this;
    }

    priority(value: XynaPriority): this {
        this._options.priority = value;
        return this;
    }
}


export interface OrderInputDetailsResult {
    rtc: RuntimeContext;
    testCaseName: string;
    documentation: string;
    orderType: string;
    orderInput: string;
    orderInputTypes: string;
    inputGenerator: string;
    id: string;
    state: string;
    tableName: string;
    workstepWithSources: string;
}


export interface GenerateInputResult {
    // on success
    orderType?: string;
    inputSourceId?: number;
    priority?: number;
    monitoringLevel?: number;
    customStringContainer?: string[];
    output?: Xo[];
    // on error
    error?: { message: string; errorCode: string }; // TODO: unify api error structure with start order
}


export interface OrderTypeVariable {
    rtc: RuntimeContext;
    fqn: FullQualifiedName;
    isList: boolean;
    // TODO: +label
}


export interface OrderTypeSignature {
    inputs: OrderTypeVariable[];
    outputs: OrderTypeVariable[];
}


export enum FileUploadStatus {
    ChoseFile = 'choseFile',
    UploadDone = 'uploadDone'
}


export class FileResult {
    constructor(
        public status: FileUploadStatus,
        public fileId: XoManagedFileID = null,
        public fileName = ''
    ) { }
}


export interface RuntimeContextSelectionSettings {
    preselectedRuntimeContext?: RuntimeContext;
    setRuntimeContext: boolean;
    showWorkspaces: boolean;
    showApplications: boolean;
}


@Injectable({ providedIn: 'root' })
export class ApiService {
    private readonly http = inject(HttpClient);
    private readonly configService = inject(ConfigService);

    private readonly runtimeContextSubject = new BehaviorSubject<RuntimeContext>(null);
    readonly runtimeContextSelectionSubject = new Subject<(settings: RuntimeContextSelectionSettings) => void>();



    constructor() {
        // create dummy instances to prevent pruning during build

        const workspace = new XoWorkspace();
        const application = new XoApplication();

    }


    set runtimeContext(value: RuntimeContext) {
        this.runtimeContextSubject.next(value);
    }


    get runtimeContext(): RuntimeContext {
        return this.runtimeContextSubject.getValue();
    }


    get runtimeContextChange(): Observable<RuntimeContext> {
        return this.runtimeContextSubject.asObservable();
    }


    // =================================================================================================================
    // structure
    // =================================================================================================================


    private getXoDescriberCachedData<T>(
        rtc: RuntimeContext,
        describers: XoDescriber[],
        cache: XoDescriberCache<T>,
        orderId: string,
        endpoint: string,
        process: (describer: XoDescriber, data: any) => T
    ): ReadonlyMap<XoDescriber, Observable<T>> {

        // result map containing a unique observable (achieved through piping) for each describer
        const resultMap = new Map<XoDescriber, Observable<T>>();
        const resultMapGetter = (describer: XoDescriber): Subject<T> => <Subject<T>>resultMap.get(describer);
        const resultMapSetter = (describer: XoDescriber, observable: Observable<T>) => {
            resultMap.set(describer, observable.pipe(map(data => process(describer, data))));
        };

        // fill result map with cached data
        if (cache) {
            cache.get(rtc, describers).forEach((value, describer) =>
                resultMapSetter(describer, value instanceof Subject ? value : of(value))
            );
        }

        // compile list of describers that are not yet in cache
        const uncachedDescribers = describers.filter(describer =>
            !resultMap.has(describer)
        );

        // create a subject for each uncached describer and add them to the result map (and cache)
        uncachedDescribers.forEach(describer => {
            const subject = new Subject<T>();
            resultMapSetter(describer, subject);
            if (cache) {
                cache.set(rtc, describer, subject);
            }
        });

        // fetch data for list of fqn strings
        if (uncachedDescribers.length > 0) {
            const url = 'runtimeContext/' + rtc.uniqueKey + '/' + endpoint;
            const payload = {
                orderId: orderId,
                objects: uncachedDescribers.map(describer => ({
                    fqn: describer.fqn.encode(),
                    rtc: describer.rtc ? describer.rtc.encode() : undefined
                }))
            };
            this.http.post(url, payload).pipe(
                // complete subject stored in result map
                finalize(() => uncachedDescribers.forEach(describer =>
                    resultMapGetter(describer).complete())
                )
            ).subscribe({
                // inform subscribers of new data (and replace subject in cache with raw data)
                next: data => uncachedDescribers.forEach(describer => {
                    const fqnString = describer.fqn.encode();
                    if (cache) {
                        cache.set(rtc, describer, data[fqnString]);
                    }
                    resultMapGetter(describer).next(data[fqnString]);
                }),
                // inform subscribers of error
                error: error => uncachedDescribers.forEach(describer => {
                    resultMapGetter(describer).error(error);
                })
            });
        }
        return resultMap;
    }


    /**
     * Request structure for a list of describers
     * @param rtc Runtime Context to be encoded inside the URL (must exist)
     * @param describers Describers of Datatypes, the structure shall be retrieved for (with Runtime Contexts !!)
     * @param cache optional cache for performance
     * @param orderId optional ID of run order, the requested structures were used in (only for Audit)
     */
    getStructure(rtc: RuntimeContext, describers: XoDescriber[], cache?: XoDescriberCache<XoStructureObject>, orderId?: string): ReadonlyMap<XoDescriber, Observable<XoStructureObject>> {
        return this.getXoDescriberCachedData(rtc, describers, cache, orderId, 'structure', (describer: XoDescriber, data: any) =>
            new XoStructureObject(null, describer.fqn.name).decode(data)
        );
    }


    /**
     * Request subtypes for a list of describers
     * @param rtc Runtime Context to be encoded inside the URL (must exist)
     * @param describers Describers of Datatypes, the subtypes shall be retrieved for (with Runtime Contexts !!)
     * @param cache optional cache for performance
     */
    getSubtypes(rtc: RuntimeContext, describers: XoDescriber[], cache?: XoDescriberCache<XoStructureType>): ReadonlyMap<XoDescriber, Observable<XoStructureType[]>> {
        return this.getXoDescriberCachedData(rtc, describers, cache, undefined, 'subtypes', (_, data: any) =>
            data.map(typeData => {
                const structureType = new XoStructureType().decode(typeData);
                // use rtc from the request, if structure type has none
                structureType.typeRtc ??= rtc;
                return structureType;
            })
        );
    }


    getSignature(rtc: RuntimeContext, orderType: string): Observable<OrderTypeSignature> {
        const url = 'runtimeContext/' + rtc.uniqueKey + '/signature';
        const payload = {
            'fqn': orderType
        };
        return this.http.post(url, payload).pipe(
            map((data: any) => {
                data.inputs.forEach(input => {
                    input.fqn = FullQualifiedName.decode(input.fqn);
                    input.rtc = RuntimeContext.decode(input.rtc);
                });
                data.outputs.forEach(output => {
                    output.fqn = FullQualifiedName.decode(output.fqn);
                    output.rtc = RuntimeContext.decode(output.rtc);
                });
                return data;
            })
        );
    }


    // =================================================================================================================
    // Runtime Contexts
    // =================================================================================================================

    private runtimeContexts$?: Observable<XoRuntimeContext[]>;


    getRuntimeContexts(useCache = false): Observable<XoRuntimeContext[]> {
        const rtc = RuntimeContext.guiHttpApplication;
        const orderType = 'xmcp.factorymanager.shared.GetRuntimeContexts';

        if (!this.runtimeContexts$ || !useCache) {
            this.runtimeContexts$ = this.startOrderAssertFlat<XoRuntimeContext>(
                rtc,
                orderType,
                undefined,
                XoRuntimeContextArray
            ).pipe(
                shareReplay(1)
            );
        }

        return this.runtimeContexts$;
    }


    // =================================================================================================================
    // orders
    // =================================================================================================================


    /**
     * Starts an order and returns the result as an observable
     *
     * @param rtc       Runtime context to start order in
     * @param orderType Order type to start (eg. workflow name)
     * @param input     Input objects of the order
     * @param output    Output classes of the order (if not set, class will be auto-deduced)
     * @param options   Options to start order with
     */
    startOrder(rtc: RuntimeContext, orderType: string, input?: Xo | Xo[], output?: XoClassInterface | XoClassInterface[], options?: StartOrderOptions): Observable<StartOrderResult> {
        options ??= StartOrderOptionsBuilder.defaultOptions;

        const url = 'runtimeContext/' + rtc.uniqueKey + '/startorder';
        const payload = {
            'orderType': orderType,
            'input': pack(input).map(value => value ? value.encode() : null),
            'async': options.async,
            'inputSourceId': options.inputSourceId,
            'customStringContainer': options.customStringContainer,
            'monitoringLevel': options.monitoringLevel,
            'priority': options.priority
        };

        return this.http.post<StartOrderResult<XoJson> & XoJson>(url, payload).pipe(
            // discard results with error message unless explicitely requested
            filter((result: StartOrderResult<XoJson> & XoJson) =>
                !result.errorMessage || options.withErrorMessage
            ),
            // convert legacy format to a start order response, if needed
            tap((result: StartOrderResult<XoJson> & XoJson) => {
                if (!result.$meta) {
                    // set $meta to the corresponding start order response json
                    result.$meta = {
                        fqn: result.errorMessage
                            ? 'xmcp.xact.startorder.StartOrderExceptionResponse'
                            : 'xmcp.xact.startorder.StartOrderSuccessResponse',
                        rtc: { application: 'GuiHttp' }
                    };
                    // wrap output in an anytype xo array json
                    (<any>result).output = <XoJson>{
                        $meta: { fqn: 'base.AnyType' },
                        $list: result.output ?? []
                    };
                }
            }),
            // decode result as a start order response
            map(result => {
                const resultClassInterface = XoDerivedClassInterfaceFrom(result);
                if (resultClassInterface) {
                    // extract output from the anytype xo array json, because it needs to be decoded separately
                    const outputs: XoJson[] = (<any>result).output?.$list ?? [];
                    result.output = undefined;
                    // decode result
                    const resultClass = new resultClassInterface().decode(result);
                    // parse outputs of successful start order responses
                    if (resultClass instanceof XoStartOrderSuccessResponse) {
                        resultClass.output = outputs.map((json, idx) => {
                            const outputClassInterface = pack(output)[idx] ?? XoDerivedClassInterfaceFrom(json);
                            return outputClassInterface && json
                                ? new outputClassInterface().decode(json)
                                : null;
                        });
                    }
                    // return start order response
                    if (resultClass instanceof XoStartOrderResponse) {
                        return resultClass;
                    }
                }
            })
        );
    }


    /**
     * Starts an order asserting that the resulting observable will always be called with an instance of the output class.
     * The order being started is supposed to have only one output. Further outputs will be discarded.
     *
     * @param rtc       Runtime context to start order in
     * @param orderType Order type to start (eg. workflow name)
     * @param input     Input objects of the order
     * @param output    Output class of the order
     * @param fallback  Fallback instance (can also be NULL)
     * @return          Observable containing either
     *                  (1) the output of the started order
     *                  or, if the output is missing or of a different class,
     *                  (2) the fallback object
     *                  or, if the fallback is undefined,
     *                  (3) a newly created instance of the output class
     */
    startOrderAssert<T extends Xo = never, C extends XoClassInterface<T> = XoClassInterface<T>>(rtc: RuntimeContext, orderType: string, input: Xo | Xo[], output: C, fallback?: T): Observable<T> {
        const options = StartOrderOptionsBuilder.defaultOptionsWithErrorMessage;
        return this.startOrder(rtc, orderType, input, output, options).pipe(
            map(result => result.output?.[0]),
            map(xo => xo instanceof output ? xo : (fallback !== undefined ? fallback : new output()))
        );
    }


    /**
     * Starts an order asserting that the resulting observable will always be called with an array containing instances of the output class' array type.
     * The order being started is supposed to have only one list-like output. Further outputs will be discarded.
     *
     * @param rtc       Runtime context to start order in
     * @param orderType Order type to start (eg. workflow name)
     * @param input     Input objects of the order
     * @param output    Output class of the order
     * @return          Observable containing either
     *                  (1) the flat data array of the output of the started order
     *                  or, if the output is missing or of a different class,
     *                  (2) an empty array
     */
    startOrderAssertFlat<T extends XoObject = never, A extends XoArray<T> = XoArray<T>, C extends XoArrayClassInterface<A> = XoArrayClassInterface<A>>(rtc: RuntimeContext, orderType: string, input: Xo | Xo[], output: C): Observable<T[]> {
        return this.startOrderAssert<A>(rtc, orderType, input, output).pipe(
            map(array => array ? array.data : [])
        );
    }


    killOrders(orderIds: string[]): Observable<XoKillOrdersResponse> {
        return this.startOrderAssert<XoKillOrdersResponse>(
            RuntimeContext.guiHttpApplication,
            'xmcp.xact.modeller.KillOrders',
            XoOrderIdArray.withIds((orderIds ?? []).map(id => stringToUnboxedInteger(id))),
            XoKillOrdersResponse
        );
    }


    orderInputDetails(rtc: RuntimeContext, testCaseName: string/*, options?: Options*/): Observable<OrderInputDetailsResult> {
        // options = options || new OptionsBuilder().options;
        const url = 'runtimeContext/' + rtc.uniqueKey + '/orderinputdetails';
        const payload = {
            'testCaseName': testCaseName
        };

        return this.http.post(url, payload).pipe(
            // TODO: check error result format
            // filter((data: any) =>
            //     !data.error || options.withErrorMessage
            // ),
            map((data: any) => (
                {
                    rtc: RuntimeContext.decode(data.rtc),
                    testCaseName: data.testCaseName,
                    documentation: data.documentation,
                    orderType: data.orderType,
                    orderInput: data.orderInput,
                    orderInputTypes: data.orderInputTypes,
                    inputGenerator: data.inputGenerator,
                    id: data.id,
                    state: data.state,
                    tableName: data.tableName,
                    workstepWithSources: data.workstepWithSources
                }
            ))
        );
    }


    generateInput(rtc: RuntimeContext, testCaseName: string, options?: Options): Observable<GenerateInputResult> {
        options = options || new OptionsBuilder().options;
        const url = 'runtimeContext/' + rtc.uniqueKey + '/generateinput';
        const payload = { 'testCaseName': testCaseName };

        return this.http.post(url, payload).pipe(
            filter((data: any) =>
                !data.error || options.withErrorMessage
            ),
            map((data: any) => (
                {
                    // on success
                    orderType: data.orderType,
                    inputSourceId: data.inputSourceId,
                    priority: data.priority,
                    monitoringLevel: data.monitoringLevel,
                    customStringContainer: data.customStringContainer,
                    output: (data.output || []).map(
                        (value: XoJson) => new (XoClassInterfaceFrom(value))().decode(value)
                    ),
                    // on error
                    error: data.error
                }
            ))
        );
    }


    upload(file?: File, host?: string): Observable<XoManagedFileID> {
        const subj = new Subject<XoManagedFileID>();

        this.uploadFileToXyna(file, host).subscribe({
            next: result => {
                if (result.status === FileUploadStatus.UploadDone) {
                    subj.next(result.fileId);
                }
            },
            error: error => subj.error(error),
            complete: () => subj.complete()
        });

        return subj.asObservable();
    }


    /**
     * @param file - uploads the given file to the io end point of xyna blackedition
     * @returns Observable<FileResult> - returns the FileResult with the ManagedFileId via an Observable
     */
    private uploadFileToXyna(file?: File, host?: string): Observable<FileResult> {

        const uploadUrl: string = (host ? host + '/' : this.configService.config.zeta.url) + 'upload';

        const subject: Subject<FileResult> = new Subject();
        let fileName = '';

        /**
         * selected file was sucessfully uploaded and we start the workflow
         * @param {ProgressEvent} - EVENT
         */
        const uploadHandler = event => {
            const result = event.currentTarget.responseText;
            const match = result.match(new RegExp('stored with id (\\d*)'));
            if (match && match.length > 1) {
                const mfid = new XoManagedFileID();
                mfid.iD = match[1];
                subject.next(new FileResult(FileUploadStatus.UploadDone, mfid, fileName));
                subject.complete();
            } else {
                const err = 'could not extract managed file id from server response, which was \'' + result + '\'';
                subject.error(err);
                subject.complete();
            }
        };

        /**
         * error with the upload
         */
        const uploadErrorHandler = event => {
            subject.error('upload error');
            subject.complete();
        };

        const startXHR = (chosenFile: File) => {
            // Dateiname merken
            fileName = chosenFile.name;

            subject.next(new FileResult(FileUploadStatus.ChoseFile));

            const fd = new FormData();
            fd.append('hint', 'File:none:upload');
            fd.append('file', chosenFile);

            const xhr = new XMLHttpRequest();
            xhr.onload = uploadHandler;
            xhr.onerror = uploadErrorHandler;

            // as long as the project runs locally, we need to hardcode the host name
            // we can not use relative urls
            xhr.open('POST', uploadUrl);
            xhr.setRequestHeader('Access-Control-Allow-Headers', '*');
            xhr.send(fd); // starts the "upload"
        };

        if (file) {
            startXHR(file);
        } else {
            this.browse().subscribe(
                chosenFile => {
                    startXHR(chosenFile);
                }
            );
        }

        return subject.asObservable();
    }


    /**
     * Note: Because the cancelation of the native file selection dialog is undetectable
     * there is no guarantee that the Observable completes
     * @param timeout - (optional) time in milliseconds, which completes the observable
     */
    browse(timeout?: number): Observable<File> {
        const subject: Subject<File> = new Subject();
        const fileInput = document.createElement('INPUT');

        const changeHandler = function (event) {
            document.body.removeChild(fileInput);

            // selects the first file even if more than one file was selected
            const file = event.currentTarget.files[0];
            subject.next(file);
            subject.complete();
        };

        (fileInput as HTMLInputElement).type = 'file';
        fileInput.onchange = changeHandler;
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        // opens an operating system file select dialog
        fileInput.click();

        if (isNumber(timeout)) {
            setTimeout(() => {
                subject.error('Timeout');
                subject.complete();
            }, timeout);
        }

        return subject.asObservable();
    }


    download(managedFileId: XoManagedFileID, host?: string) {
        const subdirectory = getSubdirectory(this.configService.config.zeta.url);
        window.location.href = (host || '') + '/' + subdirectory + 'download?p0=' + managedFileId.iD;
    }


    // =================================================================================================================
    // Encryption
    // =================================================================================================================

    protected crypt(data: XoEncryptionData, endpoint: string): Observable<XoEncryptionData> {
        return this.http.post<XoJson>(endpoint, data.encode()).pipe(
            map((result: XoJson) =>
                new XoEncryptionData().decode(result)
            ),
            catchError(error => {
                console.log(`Error during /${endpoint} of "${JSON.stringify(data.encode())}": ${error}`);
                return of(XoEncryptionData.withValues([], false));
            })
        );
    }


    /**
     * Encode/encrypt strings
     * @param values strings to encode
     * @returns encoded strings
     */
    encode(values: string[]): Observable<string[]> {
        return this.crypt(XoEncryptionData.withValues(values, false), 'encode').pipe(map(encryptionData => encryptionData.values));
    }


    /**
     * Decode/decrypt strings
     * @param values strings to decode
     * @returns decoded strings
     */
    decode(values: string[]): Observable<string[]> {
        return this.crypt(XoEncryptionData.withValues(values, true), 'decode').pipe(map(encryptionData => encryptionData.values));
    }
}
