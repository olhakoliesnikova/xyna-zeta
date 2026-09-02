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
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter, finalize } from 'rxjs/operators';

import { ApiService, RuntimeContext, StartOrderOptionsBuilder, StartOrderResult, Xo, XoAccessor, XoAccessorMapPropertySeparator, XoArray, XoArrayClass, XoArrayClassInterface, XoObject, XoObjectClass, XoObjectClassInterface, XoProperty, XynaMonitoringLevel, XynaPriority } from '../../api';
import { isObject, pack } from '../../base';
import { I18nService } from '../../i18n';
import { XcSortDirection, XcSortDirectionFromString } from '../shared/xc-sort';
import { XcTemplate } from '../xc-template/xc-template';
import { XcTableColumn, XcTableDataRequestOptions, XcTableDataSource } from './xc-table-data-source';


@XoObjectClass(null, 'xmcp.tables.datatypes', 'TableColumn')
export class XoTableColumn extends XoObject {

    @XoProperty()
    path: string;

    @XoProperty()
    name: string;

    @XoProperty()
    disableSort?: boolean;

    @XoProperty()
    disableFilter?: boolean;

    @XoProperty()
    shrink?: boolean;

    @XoProperty()
    break?: boolean;

    @XoProperty()
    pre?: boolean;

    @XoProperty()
    sort?: string;

    @XoProperty()
    filter?: string;

    @XoProperty()
    filterTooltip?: string;

    @XoProperty()
    filterMultiselect?: boolean;

    @XoProperty()
    align?: string;
  
    @XoProperty()
    pronunciationLang?: string;

    get asXcTableColumn(): XcTableColumn {
        return {
            name: this.name,
            path: this.path,
            disableSort: this.disableSort,
            disableFilter: this.disableFilter,
            shrink: this.shrink,
            break: this.break,
            pre: this.pre,
            filterTooltip: this.filterTooltip,
            filterMultiselect: this.filterMultiselect,
            pronunciationLang: this.pronunciationLang,
            align: this.align
        };
    }
}


@XoArrayClass(XoTableColumn)
export class XoTableColumnArray extends XoArray<XoTableColumn> {
}


@XoObjectClass(null, 'xmcp.tables.datatypes', 'TableInfo')
export class XoTableInfo extends XoObject {

    @XoProperty()
    rootType: string;

    @XoProperty()
    version: string;

    @XoProperty()
    bootstrap: boolean;

    @XoProperty()
    skip: number;

    @XoProperty()
    limit: number;

    @XoProperty()
    length: number;

    @XoProperty(XoTableColumnArray)
    columns: XoTableColumnArray;
}


@XoArrayClass(XoTableInfo)
export class XoTableInfoArray extends XoArray<XoTableInfo> {
}


@XoObjectClass(null, 'base', 'Count')
export class XoCount extends XoObject {

    @XoProperty()
    count: number;
}


export interface XoRemappingAccessor<T extends XoObject> {
    src: XoAccessor<T>;
    dst: XoAccessor<T>;
}


export function XoRemappingTableInfoClass<T extends XoObject>(baseClass: XoObjectClassInterface<XoTableInfo>, clazz: XoObjectClassInterface<T>, ...accessors: XoRemappingAccessor<T>[]) {

    const propertyPaths = <any>clazz.getAccessorMap();
    const propertyMappings = accessors.map(accessor => ({
        srcPath: isObject(accessor.src(propertyPaths))
            ? accessor.src(propertyPaths)[XoAccessorMapPropertySeparator]
            : accessor.src(propertyPaths),
        dstPath: isObject(accessor.dst(propertyPaths))
            ? accessor.dst(propertyPaths)[XoAccessorMapPropertySeparator]
            : accessor.dst(propertyPaths)
    }));

    return class XoRemappingTableInfo extends baseClass {

        protected remapColumn(srcPath: string, dstPath: string) {
            if (this.columns && srcPath && dstPath) {
                this.columns.data
                    .filter(column => column.path === srcPath)
                    .forEach(column => column.path = dstPath);
            }
        }

        protected remapRevert() {
            propertyMappings.forEach(mapping => this.remapColumn(mapping.dstPath, mapping.srcPath));
        }

        protected remapAction() {
            propertyMappings.forEach(mapping => this.remapColumn(mapping.srcPath, mapping.dstPath));
        }

        protected beforeEncode() {
            super.beforeEncode();
            this.remapRevert();
        }

        protected afterEncode() {
            super.afterEncode();
            this.remapAction();
        }

        protected afterDecode() {
            super.afterDecode();
            this.remapAction();
        }
    };
}


export interface XoSplicingAccessor<T extends XoObject> {
    src: XoAccessor<T>;
    items?: {
        idx?: number;
        name?: string;
        disableFilter?: boolean;
        disableSort?: boolean;
        shrink?: boolean;
        filterMultiselect?: boolean;
    };
}


export function XoSplicingTableInfoClass<T extends XoObject>(baseClass: XoObjectClassInterface<XoTableInfo>, clazz: XoObjectClassInterface<T>, ...accessors: XoSplicingAccessor<T>[]) {

    const propertyPaths = <any>clazz.getAccessorMap();
    const propertyMappings = accessors.map(accessor => {
        const path = isObject(accessor.src(propertyPaths))
            ? accessor.src(propertyPaths)[XoAccessorMapPropertySeparator]
            : accessor.src(propertyPaths);
        const idx = accessor.items && accessor.items.idx !== undefined
            ? accessor.items.idx
            : -1;
        const column = accessor.items ? new XoTableColumn() : undefined;
        if (column) {
            column.name = accessor.items.name;
            column.path = path;
            column.disableFilter = accessor.items.disableFilter;
            column.disableSort = accessor.items.disableSort;
            column.shrink = accessor.items.shrink;
            column.filterMultiselect = accessor.items.filterMultiselect;
        }
        return { path: path, idx: idx, column: column, remove: !accessor.items };
    });

    return class XoSplicingTableInfo extends baseClass {

        protected spliceColumn(mapping: { path: string; idx: number; column: XoTableColumn }, remove: boolean, forEachIndex: number) {
            if (this.columns && mapping.path) {
                if (!remove) {
                    this.columns.data.splice(mapping.idx >= 0 ? mapping.idx : this.columns.length, 0, mapping.column);
                } else {
                    const idx = this.columns.data.findIndex(c => c.path === mapping.path);
                    if (idx >= 0) {
                        mapping.idx = idx + forEachIndex;
                        mapping.column = this.columns.data.splice(idx, 1)[0];
                    }
                }
            }
        }

        protected spliceRevert() {
            propertyMappings.forEach((mapping, idx) => this.spliceColumn(mapping, !mapping.remove, idx));
        }

        protected spliceAction() {
            propertyMappings.forEach((mapping, idx) => this.spliceColumn(mapping, mapping.remove, idx));
        }

        protected beforeEncode() {
            super.beforeEncode();
            this.spliceRevert();
        }

        protected afterEncode() {
            super.afterEncode();
            this.spliceAction();
        }

        protected afterDecode() {
            super.afterDecode();
            this.spliceAction();
        }
    };
}


export class XcRemoteTableDataSource<T extends XoObject = XoObject, O extends XoArray<T> = XoArray<T>> extends XcTableDataSource<T> {

    /** Table info version */
    static readonly version = '1.2';

    /** Subject handling table workflow errors */
    protected readonly errorSubject = new Subject<StartOrderResult>();

    /** Subject with last responded table info */
    protected readonly tableInfoSubject = new BehaviorSubject<XoTableInfo>(null);

    /** Additional inputs besides the table info */
    input?: Xo | Xo[];

    /** Class to instantiate for the output array */
    output?: XoArrayClassInterface<O>;

    /** Xyna monitoring level for the execution of the table workflow */
    monitoringLevel?: XynaMonitoringLevel;

    /** Xyna priority for the execution of the table workflow */
    priority?: XynaPriority;

    /**
     * Order type for a Count-Workflow, which is called together with the TableInfo-Workflow with exactly the same inputs.
     * Response must be of type *base.Count*.
     *
     * If not specified, no Count-Workflow will be called.
     *
     * @remark In some cases, counting the number of total hits for a query takes longer than querying a limited amount of the hits.
     * So this process can be split such that the user already gets (a limited amount of) the hits before he knows how many hits
     * there are in total.
     */
    totalCountOrderType: string;


    constructor(protected apiService: ApiService, i18n: I18nService, public rtc: RuntimeContext, public orderType: string, public tableInfoClass: XoObjectClassInterface<XoTableInfo> = XoTableInfo) {
        super(i18n);
        this.debounceTime = XcTableDataSource.DEFAULT_DEBOUNCE_TIME;
        this.moreData.subscribe(() => {
            this.skip = this.rows.length;
            this.refresh();
        });
    }


    protected request(options: XcTableDataRequestOptions) {
        this.requestErrorMessage = null;
        let rows: T[];
        // execute startorder call to fetch table info and rows
        let tableInfoInstance: XoTableInfo;
        if (this.lastTableInfo) {
            let columnInfo: XoTableColumn;
            // use available table info
            tableInfoInstance = this.lastTableInfo;
            // reset sort and filters
            tableInfoInstance.columns.data.forEach(column => {
                column.sort = undefined;
                column.filter = undefined;
            });
            // add filters
            if (options.filter) {
                options.filter.map.forEach((value, key) => {
                    if ((columnInfo = tableInfoInstance.columns.data.find(column => column.path === key))) {
                        columnInfo.filter = value;
                    } else {
                        console.warn('Column "' + key + '" was not found and thus the filter value "' + value + '" could not be set.');
                    }
                });
            }
            // add sort
            if (options.sort && (columnInfo = tableInfoInstance.columns.data.find(column => column.path === options.sort.path))) {
                columnInfo.sort = XcSortDirection[options.sort.direction];
            }
        } else {
            // create table info for bootstrapping table
            tableInfoInstance = new this.tableInfoClass();
            tableInfoInstance.version = XcRemoteTableDataSource.version;
            tableInfoInstance.bootstrap = true;
        }
        // set skip and limit
        tableInfoInstance.skip = options.skip;
        tableInfoInstance.limit = options.limit;
        // reset length, since it is solely determined by the server
        tableInfoInstance.length = undefined;
        // compile input and output start order
        const input = [tableInfoInstance, ...pack(this.input)];
        const output = [this.tableInfoClass, ...pack(this.output)];
        // remember previous filters
        const previousFilters = new Map<string, string>(options.filter ? options.filter.map.entries() : undefined);
        let discardResponse = false;
        // server call
        this.apiService.startOrder(
            this.rtc,
            this.orderType,
            input,
            output,
            new StartOrderOptionsBuilder()
                .withErrorMessage(true)
                .monitoringLevel(this.monitoringLevel)
                .priority(this.priority)
                .options
        ).pipe(
            filter(() => {
                if (this.refreshOnFilterChange) {
                    // discard response if current filters don't match with those at request-time
                    if (this.filters.size !== previousFilters.size) {
                        discardResponse = true;
                    } else {
                        for (const key of this.filters.keys()) {
                            if (previousFilters.get(key) !== this.filters.get(key)) {
                                discardResponse = true;
                                break;
                            }
                        }
                    }
                }
                return !discardResponse;
            }),
            finalize(() => {
                this.tableData = discardResponse
                    // set previous data to regularly finish refresh
                    ? this.tableData
                    // set new data
                    : {
                        rows: rows ?? [],
                        columns: this.lastTableInfo?.columns?.data.map(column => column.asXcTableColumn) ?? []
                    };
            })
        ).subscribe({
            next: result => {
                if (result.output?.length > 1) {
                    // set table info
                    const tableInfo = result.output[0] as XoTableInfo;
                    tableInfo.columns = tableInfo.columns || new XoTableColumnArray();
                    // set filters
                    this.filters.clear();
                    tableInfo.columns.data.forEach(column =>
                        this.filters.set(column.path, column.filter)
                    );
                    // set sort
                    const sortColumn = tableInfo.columns.data.find(column => !!column.sort);
                    if (sortColumn) {
                        this._sortPath = sortColumn.path;
                        this._sortDirection = XcSortDirectionFromString(sortColumn.sort.toLowerCase());
                        this._sortChange.next(true);
                    }
                    // set rows
                    rows = (result.output[1] as XoArray<T>).data;
                    if (this.skip) {
                        rows.unshift(...this.rows);
                        this.skip = undefined;
                    }
                    // set footer label
                    const length = tableInfo.length;
                    this.moreDataAvailable = length > rows.length;

                    this.tableCounts.displayedCount = rows.length;
                    if (!this.totalCountOrderType) {
                        this.tableCounts.totalCount = length;
                    }
                    this.tableInfoSubject.next(tableInfo);
                    this.updateTableCount();
                } else {
                    this.requestErrorMessage = result.errorMessage;
                    this.errorSubject.next(result);
                }
            },
            error: error => this.errorSubject.error(error)
        });

        // start Count-Workflow if defined
        if (this.totalCountOrderType) {
            // (input[0] as XoTableInfo).limit = 100;

            this.apiService.startOrderAssert<XoCount>(
                this.rtc,
                this.totalCountOrderType,
                input,
                XoCount
            ).subscribe(count => {
                this.tableCounts.totalCount = count.count;
                this.updateTableCount();
            });
        }
    }


    protected updateTableCount() {
        this.footerLabelRight = this.tableCounts.displayedCount !== undefined && this.tableCounts.totalCount !== undefined
            ? this.tableCounts.displayedCount + '/' + this.tableCounts.totalCount
            : undefined;
        this.countSubject.next(this.tableCounts);
    }


    // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
    resolve(row: T, path: string): XcTemplate[] | Object {
        return this.resolveXo(row, path);
    }


    get error(): Observable<StartOrderResult> {
        return this.errorSubject.asObservable();
    }


    get lastTableInfo(): XoTableInfo {
        return this.tableInfoSubject.value;
    }


    get tableInfoChange(): Observable<XoTableInfo> {
        return this.tableInfoSubject.asObservable();
    }


    resetTableInfo() {
        this.tableInfoSubject.next(null);
    }
}
