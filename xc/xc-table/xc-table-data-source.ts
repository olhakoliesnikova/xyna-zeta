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
import { merge, Observable, Subject, Subscription } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';

import { CollectionViewer } from '@angular/cdk/collections';

import { Xo, XoObject } from '../../api';
import { Comparable } from '../../base';
import { I18nService } from '../../i18n';
import { XcOptionItem } from '../shared/xc-item';
import { XcSubSelectionModel } from '../shared/xc-selection';
import { XcSelectionDataSource } from '../shared/xc-selection-data-source';
import { XcSortDirection } from '../shared/xc-sort';
import { XcTemplate } from '../xc-template/xc-template';


export interface XcTableColumn {
    readonly path: string;
    readonly name: string;
    readonly disableSort?: boolean;
    readonly disableFilter?: boolean;
    readonly shrink?: boolean;
    readonly break?: boolean;
    readonly pre?: boolean;
    readonly filterTooltip?: string;
    readonly filterMultiselect?: boolean;
    readonly pronunciationLang?: string;
    readonly align?: string;
}


export interface XcTableData<T> {
    rows: T[];
    columns: XcTableColumn[];
}


export interface XcTableDataActionElement<T>  {
    onShow?: (row: T) => boolean;
    onAction: (row: T) => void;
    iconName: string;
    iconStyle?: string;
    tooltip?: string;
    disabled?: boolean;
    class?: string;
    ariaLabel?: string;
}


export interface XcTableDataFilter {
    map: ReadonlyMap<string, string>;
    caseSensitive: boolean;
}


export interface XcTableDataSort {
    path: string;
    direction: XcSortDirection;
}


export interface XcTableDataRequestOptions {
    readonly filter?: XcTableDataFilter;
    readonly sort?: XcTableDataSort;
    readonly skip?: number;
    readonly limit?: number;
}


export interface TableCounts {
    displayedCount: number;
    totalCount: number;
}


export const MULTISELECT_FILTER_SEPARATOR = '|';


export abstract class XcTableDataSource<T extends Comparable = Comparable> extends XcSelectionDataSource<T, XcSubSelectionModel<T, string>> {

    static readonly DEFAULT_DEBOUNCE_TIME = 500;

    private _subscription: Subscription;
    private _tableData: XcTableData<T>;
    private _debounceTime = 0;

    protected _sortPath: string;
    protected _sortDirection = XcSortDirection.none;

    protected readonly _sortChange = new Subject<boolean>();
    protected readonly _filterChange = new Subject<boolean>();
    protected readonly _filtersReset = new Subject<boolean>();

    protected readonly filters = new Map<string, string>();
    readonly filterEnums = new Map<string, Observable<XcOptionItem[]>>();
    readonly filterEnumsAsInput = new Set<string>();
    readonly filterEnumsAsMultiselect = new Set<string>();
    readonly moreData = new Subject<void>();

    /** skip the first number of entries */
    skip: number;

    /** limit the number of entries to retrieve */
    limit: number;

    /** if true, refreshes each time a filter changes (while typing text - with a debounce time) */
    refreshOnFilterChange = true;

    /** action elements occurring at the end of each row when active or hovering */
    actionElements: XcTableDataActionElement<T>[];

    filterCaseSensitive = false;
    moreDataAvailable = false;
    requestErrorMessage: string;

    footerLabelLeft: string;
    footerLabelRight: string;
    showFooterLabels = true;

    protected tableCounts: TableCounts = { displayedCount: undefined, totalCount: undefined };
    protected readonly countSubject = new Subject<TableCounts>();

    stylesFunction: (row: T, path: string) => string[];


    constructor(readonly i18n?: I18nService, readonly translateLabels: boolean = true) {
        super(new XcSubSelectionModel<T, string>());
    }


    private removeSubscription() {
        if (this._subscription) {
            this._subscription.unsubscribe();
        }
    }


    private updateSubscription() {
        // renew subscription
        this.removeSubscription();
        const sortOrFilterChange = this.refreshOnFilterChange ? merge(this.sortChange, this.filterChange) : this.sortChange;
        this._subscription = sortOrFilterChange.pipe(
            filter(internal => !internal),
            debounceTime(this.debounceTime)
        ).subscribe(() =>
            this.refresh()
        );
    }


    private updateSubject() {
        this.data = this.tableData.rows;
    }


    protected set tableData(value: XcTableData<T>) {
        this._tableData = value;
        this.updateSubject();
    }


    protected get tableData(): XcTableData<T> {
        return this._tableData;
    }


    protected abstract request(options: XcTableDataRequestOptions): void;


    // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
    protected resolveXo(row: Xo, path: string): XcTemplate[] | Object {
        // resolve and translate, if needed
        if (this.i18n) {
            const resolved = row.resolveHead(path);
            const value = resolved.value;
            if (value instanceof XoObject && value.i18nProperties.has(resolved.tail)) {
                return this.i18n.translate(value.resolve(resolved.tail));
            }
        }
        // resolve raw value
        return row.resolve(path);
    }


    // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
    abstract resolve(row: T, path: string): XcTemplate[] | Object;


    refresh() {
        super.refresh();
        // request data update
        this.request({
            filter: this.filters.size ? {map: this.filters, caseSensitive: this.filterCaseSensitive} : undefined,
            sort:   this._sortPath    ? {path: this._sortPath, direction:     this._sortDirection}      : undefined,
            skip:   this.skip,
            limit:  this.limit
        });
    }


    connect(collectionViewer: CollectionViewer): Observable<T[]> {
        this.updateSubscription();
        return super.connect(collectionViewer);
    }


    disconnect(collectionViewer: CollectionViewer) {
        super.disconnect(collectionViewer);
        this.removeSubscription();
    }


    clear() {
        if (this.tableData) {
            this.tableData.rows = [];
            this.selectionModel.clear();
            this.updateSubject();
        }
    }


    remove(row: T) {
        if (this.tableData) {
            const idx = this.tableData.rows.indexOf(row);
            if (idx >= 0) {
                this.tableData.rows.splice(idx, 1);
                if (this.selectionModel.isSelected(row)) {
                    this.selectionModel.combineOperations(() => {
                        this.selectionModel.deselect(row);
                        const selectionRow = this.tableData.rows[idx];
                        if (selectionRow) {
                            this.selectionModel.select(selectionRow);
                        }
                    });
                }
                this.updateSubject();
            }
        }
    }


    add(row: T) {
        if (this.tableData) {
            this.tableData.rows.push(row);
            this.updateSubject();
        }
    }


    setSortPathAndDirection(path: string, direction: XcSortDirection) {
        if (this._sortPath !== path || this._sortDirection !== direction) {
            this._sortPath = path;
            this._sortDirection = direction;
            this._sortChange.next(false);
        }
    }


    getSortPath(): string {
        return this._sortPath ?? '';
    }


    setSortPath(value: string) {
        if (this._sortPath !== value) {
            this._sortPath = value;
            this._sortChange.next(false);
        }
    }


    getSortDirection(): XcSortDirection {
        return this._sortDirection;
    }


    setSortDirection(value: XcSortDirection) {
        if (this._sortDirection !== value) {
            this._sortDirection = value;
            this._sortChange.next(false);
        }
    }


    getColumnPaths(): IterableIterator<string> {
        return this.filters.keys();
    }


    getFilter(path: string): string {
        return this.filters.get(path) ?? '';
    }


    hasFilters(): boolean {
        return this.filters.size > 0;
    }


    setFilter(path: string, value: string) {
        if (value && value !== this.filters.get(path)) {
            this.filters.set(path, value);
            this.filterChange.next(false);
        }
        if (!value && this.filters.get(path)) {
            this.filters.delete(path);
            this.filterChange.next(false);
        }
        this.triggerMarkForChange();
    }


    resetFilters() {
        this.filters.clear();
        this.filtersReset.next(false);
        this.filterChange.next(false);
        this.triggerMarkForChange();
    }


    applyFilters() {
        this.filterChange.next(false);
        if (!this.refreshOnFilterChange) {
            this.refresh();
        }
    }


    get rows(): T[] {
        return this.tableData
            ? this.tableData.rows
            : [];
    }


    get columns(): XcTableColumn[] {
        return this.tableData
            ? this.tableData.columns
            : [];
    }


    get debounceTime(): number {
        return this._debounceTime;
    }


    set debounceTime(value: number) {
        this._debounceTime = value;
        this.updateSubscription();
    }


    get sortChange(): Subject<boolean> {
        return this._sortChange;
    }


    get filterChange(): Subject<boolean> {
        return this._filterChange;
    }


    get filtersReset(): Subject<boolean> {
        return this._filtersReset;
    }


    get countChange(): Observable<TableCounts> {
        return this.countSubject.asObservable();
    }
}
