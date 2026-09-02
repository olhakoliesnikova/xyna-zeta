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
import { BehaviorSubject, combineLatest, from, Observable, of, Subject, Subscription } from 'rxjs';
import { concatMap, distinctUntilChanged, filter, map, tap } from 'rxjs/operators';

import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ComponentType } from '@angular/cdk/portal';
import { NgComponentOutlet } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ComponentRef, EventEmitter, inject, Injector, Input, OnDestroy, Output, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { MatTab, MatTabGroup, MatTabLabel } from '@angular/material/tabs';

import { coerceBoolean } from '../../base';
import { I18nService, LocaleService, XcI18nPipe } from '../../i18n';
import { XcThemeableComponent } from '../../xc/shared/xc-themeable.component';
import { XcIconButtonComponent } from '../xc-button/xc-icon-button.component';
import { XcIconComponent } from '../xc-icon/xc-icon.component';
import { XcContextMenuTriggerDirective } from '../xc-menu/xc-context-menu-trigger.directive';
import { XcMenuService } from '../xc-menu/xc-menu.service';
import { XcMenuItem } from '../xc-menu/xc-menu.types';
import { XcSpinnerComponent } from '../xc-spinner/xc-spinner.component';
import { XcTooltipDirective } from '../xc-tooltip/xc-tooltip.directive';
import { xcTabBarTranslations_deDE } from './locale/xc-tab-bar-translations.de-DE';
import { xcTabBarTranslations_enUS } from './locale/xc-tab-bar-translations.en-US';
import { XC_TAB_DATA, XcTabBarInterface, XcTabBarItem, XcTabComponent, XcTabContextMenuItem, XcTabMenuEntry, XcTabMenuItem, XcTabRef } from './xc-tab.component';


@Component({
    selector: 'xc-tab-bar',
    templateUrl: './xc-tab-bar.component.html',
    styleUrls: ['./xc-tab-bar.component.scss'],
    imports: [MatTabGroup, MatTab, MatTabLabel, XcIconComponent, XcTooltipDirective, XcIconButtonComponent, NgComponentOutlet, XcSpinnerComponent, XcI18nPipe, CdkDrag, CdkDropList, XcContextMenuTriggerDirective
    ]
})
export class XcTabBarComponent extends XcThemeableComponent implements XcTabBarInterface, AfterViewInit, OnDestroy {
    private readonly injector = inject(Injector);
    protected readonly i18n = inject(I18nService);
    protected readonly menuService = inject(XcMenuService);
    private readonly cdr = inject(ChangeDetectorRef);

    private _tabGroup: MatTabGroup;
    private _componentOutlets: QueryList<NgComponentOutlet>;
    private readonly _componentInjectors = new Map<XcTabBarItem, Injector>();
    private readonly _componentSubjects = new Map<XcTabBarItem, Subject<XcTabComponent>>();
    private readonly _componentInitialized = new Set<XcTabBarItem>();
    private _focusedIndex = -1;
    private _showTooltips = false;
    private _busySubject = new BehaviorSubject<boolean>(false);
    private subscription: Subscription;
    private _items: XcTabBarItem[] = [];
    private _tabIdCounter = 1;
    private _reorderable = false;
    private _contextMenu = false;

    @Input('xc-tab-bar-items')
    set items(value: XcTabBarItem[]) {

        value?.forEach(item => {
            if (item.tabId == null) {
                item.tabId = this._tabIdCounter++;
            }
        });

        this._items = value ?? [];
    }

    get items(): XcTabBarItem[] {
        return this._items;
    }

    @Input({alias: 'xc-tab-bar-reorderable', transform: coerceBoolean})
    set reorderable(value: boolean) {
        this._reorderable = value;
    }

    get reorderable(): boolean {
        return this._reorderable;
    }

    @Input({alias: 'xc-tab-bar-contextmenu', transform: coerceBoolean})
    set contextMenu(value: boolean) {
        this._contextMenu = value;
    }

    get contextMenu(): boolean {
        return this._contextMenu;
    }

    @Output('xc-tab-bar-selectionChange')
    readonly selectionChange = new EventEmitter<XcTabBarItem>();

    readonly tabMenuItems: XcMenuItem[] = [];

    constructor() {
        super();
        this.i18n.setTranslations(LocaleService.DE_DE, xcTabBarTranslations_deDE);
        this.i18n.setTranslations(LocaleService.EN_US, xcTabBarTranslations_enUS);
        this.color = 'primary';
    }


    ngOnDestroy(): void {
        this.subscription?.unsubscribe();
        this._busySubject.complete();
    }


    ngAfterViewInit(): void {
        // select first tab by default
        if (this.items.length > 0) {
            this.selection = this.items[0];
        }
    }


    private _getComponentInstance(item: XcTabBarItem): XcTabComponent | null {
        return this.componentOutlets.map(outlet =>

            (outlet['_componentRef'] as ComponentRef<XcTabComponent>).instance
        ).find(instance =>
            instance.tabBarItem === item
        );
    }


    private activate(item: XcTabBarItem, idx: number) {
        if (item) {
            item.afterActivate?.(idx);
            setTimeout(() => {
                this._componentInitialized.add(item);
            }, 0);
        }
    }


    private deactivate(item: XcTabBarItem, idx: number) {
        if (item) {
            item.afterDeactivate?.(idx);
        }
    }


    private get focusedItem(): XcTabBarItem {
        return this.items[this._focusedIndex];
    }


    private getIndex(item: XcTabBarItem): number {
        return this.items.indexOf(item);
    }

    private isClosable(item: XcTabBarItem): boolean {
        return !!item?.closable && !item?.pinned;
    }

    mouseup(event: MouseEvent, item: XcTabBarItem) {
        if (event.button === 1 && this.isClosable(item)) {
            this.close(item).subscribe();
        }
    }


    @Input('xc-tab-bar-selection')
    set selection(value: XcTabBarItem) {
        const idx = this.items.indexOf(value);
        // select tab idx
        if (idx >= 0) {
            const uninitialized = !this._componentInitialized.has(value);
            this.tabGroup.selectedIndex = idx;
            if (uninitialized) {
                this.activate(value, idx);
            }
        }
    }


    get selection(): XcTabBarItem {
        return this.items[this.tabGroup.selectedIndex];
    }


    @Input({alias: 'xc-tab-bar-showtooltips', transform: coerceBoolean})
    set showTooltips(value: boolean) {
        this._showTooltips = value;
    }


    get showTooltips(): boolean {
        return this._showTooltips;
    }


    @Input({transform: coerceBoolean})
    set busy(value: boolean) {
        this._busySubject.next(value);
    }


    get busy(): boolean {
        return this._busySubject.value;
    }


    @ViewChild(MatTabGroup, { static: true })
    get tabGroup(): MatTabGroup {
        return this._tabGroup;
    }

    private get busyObservable(): Observable<boolean> {
        return this._busySubject.asObservable().pipe(distinctUntilChanged());
    }


    set tabGroup(value: MatTabGroup) {
        this._tabGroup = value;
        this.subscription?.unsubscribe();
        this.subscription = combineLatest([this.tabGroup.selectedIndexChange, this.busyObservable]).pipe(
            filter(([index, busy]) => !busy),
            map(([index, busy]) => index),
            distinctUntilChanged()
        ).subscribe(index => this.selectedIndexChange(index));
    }


    private selectedIndexChange(index: number) {
        // call after-deactivate handler
        this.deactivate(this.focusedItem, this._focusedIndex);
        // change focused index
        this._focusedIndex = index;
        this.selectionChange.emit(this.focusedItem);
        // call after-activate handler
        this.activate(this.focusedItem, this._focusedIndex);
    }


    @ViewChildren(NgComponentOutlet)
    set componentOutlets(value: QueryList<NgComponentOutlet>) {
        const completeItems = new Array<XcTabBarItem>();
        let instance: XcTabComponent;
        this._componentOutlets = value;
        this._componentSubjects.forEach((subject, item) => {
            if ((instance = this._getComponentInstance(item))) {
                // notify getComponentInstance() observers
                subject.next(instance);
                subject.complete();
                // remember item with complete subject
                completeItems.push(item);
            }
        });
        // remove all items with complete subjects from map
        completeItems.forEach(item => this._componentSubjects.delete(item));
    }


    get componentOutlets(): QueryList<NgComponentOutlet> {
        return this._componentOutlets;
    }


    getComponent(item: XcTabBarItem): ComponentType<XcTabComponent<any, any>> {
        return item.component;
    }


    getComponentInjector(item: XcTabBarItem): Injector {
        return this._componentInjectors.get(item) || this._componentInjectors.set(
            item, Injector.create({
                providers: [
                    { provide: XC_TAB_DATA, useValue: item.data },
                    { provide: XcTabRef, useValue: new XcTabRef(this, item) }
                ],
                parent: this.injector
            })
        ).get(item);
    }


    getComponentInstance(item: XcTabBarItem): Observable<XcTabComponent<any, any>> {
        const instance = this._getComponentInstance(item);
        return instance
            ? of(instance)
            : (this._componentSubjects.get(item) || this._componentSubjects.set(item, new Subject<XcTabComponent>()).get(item)).asObservable();
    }


    isComponentInitialized(item: XcTabBarItem): boolean {
        return this._componentInitialized.has(item);
    }


    getTooltip(item: XcTabBarItem): string {

        if (item.pinned) {
            return item.name;
        }

        if (this.showTooltips) {
            return item.name;
        }

        return undefined;
    }


    getIcon(item: XcTabBarItem): string {

        if (item.pinned && !item.icon) {
            return 'file';
        }

        return item.icon;
    }


    open(item: XcTabBarItem, beforeItem?: XcTabBarItem, inBackground = false): Observable<XcTabComponent<any, any>> {
        if (item.tabId == null) {
            item.tabId = this._tabIdCounter++;
        }

        // insert new item before another item or at the end
        const idx = this.items.indexOf(beforeItem);
        this.items.splice(idx < 0 ? this.items.length : idx, 0, item);
        // switch to new item, if not opened in background
        if (!inBackground) {
            // necessary to counter-act angular material bugfix:
            // "maintain selected tab when new tabs are added or removed"
            // see: https://github.com/angular/material2/pull/9132/files
            this.tabGroup._tabs.forEach(tab => tab.isActive = false);
            // switch to new item
            this.selection = item;
        }
        return this.getComponentInstance(item);
    }


    close(item: XcTabBarItem, result?: any, selectItem?: XcTabBarItem): Observable<boolean> {

        if (item.pinned) {
            return of(false);
        }

        const instance = this._getComponentInstance(item);

        const beforeDismiss$ = instance
            ? instance.beforeDismiss().pipe(
                filter(success => success)
            )
            : of(true);

        return beforeDismiss$.pipe(
            tap(() => {

                const tabInjector = this._componentInjectors.get(item);

                // Aufräumen nur wenn vorhanden
                if (tabInjector) {
                    tabInjector.get(XcTabRef).notifyClose(result);
                    this._componentInjectors.delete(item);
                }

                const subject = this._componentSubjects.get(item);
                if (subject) {
                    subject.complete();
                    this._componentSubjects.delete(item);
                }

                this._componentInitialized.delete(item);

                // Aktuelle Werte merken
                const closedIdx = this.items.indexOf(item);
                const selectedIdx = this.tabGroup.selectedIndex;

                // Tab entfernen
                this.items = this.items.filter(tab => tab !== item);

                // Neue Selektion berechnen
                let selectIdx = this.items.indexOf(selectItem);

                if (selectIdx < 0) {
                    selectIdx = closedIdx < selectedIdx
                        ? selectedIdx - 1
                        : Math.min(selectedIdx, this.items.length - 1);
                }

                if (this.items.length === 0) {
                    this._focusedIndex = -1;
                    this.tabGroup.selectedIndex = -1;
                } else {
                    this.tabGroup.selectedIndex = Math.max(0, selectIdx);
                }

                if (selectedIdx === closedIdx && selectedIdx === selectIdx) {
                    this.deactivate(item, selectedIdx);
                    this.selectionChange.emit(this.focusedItem);
                    this.activate(this.focusedItem, this._focusedIndex);
                }

                this.refreshAfterMenuAction();
            })
        );
    }


    private closeTabsSequentially(tabs: XcTabBarItem[]) {
        return from(tabs).pipe(
            concatMap(tab => this.close(tab))
        );
    }


    closeAll() {
        const tabs = this.items.filter(tab => this.isClosable(tab));

        this.closeTabsSequentially(tabs).subscribe();
    }


    closeOthers(item: XcTabBarItem) {
        const tabs = this.items.filter(
            tab => tab !== item && this.isClosable(tab)
        );

        this.closeTabsSequentially(tabs).subscribe();
    }


    closeLeft(item: XcTabBarItem) {
        const idx = this.getIndex(item);

        const tabs = this.items
            .slice(0, idx)
            .filter(tab => this.isClosable(tab))

        this.closeTabsSequentially(tabs).subscribe();
    }


    closeRight(item: XcTabBarItem) {
        const idx = this.getIndex(item);

        const tabs = this.items
            .slice(idx + 1)
            .filter(tab => this.isClosable(tab));

        this.closeTabsSequentially(tabs).subscribe();
    }


    moveLeft(item: XcTabBarItem) {

        if (!this.canMoveLeft(item)) {
            return;
        }

        const idx = this.getIndex(item);

        [this.items[idx - 1], this.items[idx]] =
            [this.items[idx], this.items[idx - 1]];

        this.tabGroup.selectedIndex = idx - 1;

        this.refreshAfterMenuAction();
    }


    moveRight(item: XcTabBarItem) {

        if (!this.canMoveRight(item)) {
            return;
        }

        const idx = this.getIndex(item);

        [this.items[idx], this.items[idx + 1]] =
            [this.items[idx + 1], this.items[idx]];

        this.tabGroup.selectedIndex = idx + 1;

        this.refreshAfterMenuAction();
    }

    activateStart(item: XcTabBarItem) {
        const idx = this.getIndex(item);

        if (idx > 0) {
            this.selection = this.items[0];
        }
        this.refreshAfterMenuAction();
    }


    activateEnd(item: XcTabBarItem) {
        const idx = this.getIndex(item);

        if (idx < this.items.length - 1) {
            this.selection = this.items[this.items.length - 1];
        }
        this.refreshAfterMenuAction();
    }


    activateLeft(item: XcTabBarItem) {
        const idx = this.getIndex(item);

        if (idx > 0) {
            this.selection = this.items[idx - 1];
        }
        this.refreshAfterMenuAction();
    }


    activateRight(item: XcTabBarItem) {
        const idx = this.getIndex(item);

        if (idx < this.items.length - 1) {
            this.selection = this.items[idx + 1];
        }
        this.refreshAfterMenuAction();
    }


    closeFocusedTab() {
        const item = this.items[this._focusedIndex];
        if (item?.closable) {
            this._focusedIndex = -1;
            this.close(item).subscribe();
        }
    }


    moveToStart(item: XcTabBarItem) {

        const idx = this.getIndex(item);
        const targetIdx = this.getFirstMovableIndex(item);

        if (!this.canMoveToStart(item)) {
            return;
        }

        this.items.splice(idx, 1);
        this.items.splice(targetIdx, 0, item);

        this.selection = item;

        this.refreshAfterMenuAction();
    }


    moveToEnd(item: XcTabBarItem) {

        const idx = this.getIndex(item);
        const targetIdx = this.getLastMovableIndex(item);

        if (!this.canMoveToEnd(item)) {
            return;
        }

        this.items.splice(idx, 1);
        this.items.splice(targetIdx, 0, item);

        this.selection = item;

        this.refreshAfterMenuAction();
    }


    togglePinned(item: XcTabBarItem) {

        item.pinned = !item.pinned;

        this.sortPinnedTabs();

        this.selection = item;
        this.refreshAfterMenuAction();
    }


    private sortPinnedTabs() {

        const selected = this.selection;

        const pinned = this.items.filter(item => item.pinned);
        const unpinned = this.items.filter(item => !item.pinned);

        this.items.splice(0, this.items.length, ...pinned, ...unpinned);

        if (selected) {
            this.selection = selected;
        }
    }


    private getFirstMovableIndex(item: XcTabBarItem): number {
        return item.pinned ? 0 : this.getPinnedCount();
    }


    private getLastMovableIndex(item: XcTabBarItem): number {
        return item.pinned ? Math.max(this.getPinnedCount() - 1, 0) : this.items.length - 1;
    }


    private refreshAfterMenuAction(): void {
        queueMicrotask(() => this.cdr.detectChanges());
    }


    initialized(): boolean {
        return !!this.tabGroup._tabs;
    }

    onBeforeOpen(item: XcTabBarItem): void {

        if (!this.contextMenu) {
            this.menuService.set([]);
            return;
        }

        this.menuService.set(
            this.createTabMenu(item)
        );
    }

    createTabMenu(item: XcTabBarItem): XcMenuItem[] {
        if (!this.contextMenu) {
            return [];
        }

        const closableTabs = this.getClosableTabs();
        const closableTabsLeft = this.getClosableTabsLeft(item);
        const closableTabsRight = this.getClosableTabsRight(item);
        const closableTabsExcept = this.getClosableTabsExcept(item);

        const standardItems: XcTabMenuItem[] = [
            {
                id: XcTabMenuEntry.Close,
                name: this.i18n.translate('zeta.xc-tab-bar.menu.close'),
                disabled: !this.isClosable(item),
                click: () => this.close(item).subscribe()
            },
            {
                id: XcTabMenuEntry.CloseAll,
                name: this.i18n.translate('zeta.xc-tab-bar.menu.close-all'),
                disabled: closableTabs.length === 0,
                click: () => this.closeAll()
            },
            {
                id: XcTabMenuEntry.CloseOthers,
                name: this.i18n.translate('zeta.xc-tab-bar.menu.close-others'),
                disabled: closableTabsExcept.length === 0,
                click: () => this.closeOthers(item)
            },
            {
                id: XcTabMenuEntry.CloseLeft,
                name: this.i18n.translate('zeta.xc-tab-bar.menu.close-left'),
                disabled: closableTabsLeft.length === 0,
                click: () => this.closeLeft(item)
            },
            {
                id: XcTabMenuEntry.CloseRight,
                name: this.i18n.translate('zeta.xc-tab-bar.menu.close-right'),
                disabled: closableTabsRight.length === 0,
                click: () => this.closeRight(item)
            },

            {
                id: XcTabMenuEntry.Pin,
                separator: 'above',
                name: item.pinned ? this.i18n.translate('zeta.xc-tab-bar.menu.unpin') : this.i18n.translate('zeta.xc-tab-bar.menu.pin'),
                click: () => this.togglePinned(item)
            },

            {
                id: XcTabMenuEntry.ActivateStart,
                separator: 'above',
                name: this.i18n.translate('zeta.xc-tab-bar.menu.activate-start'),
                disabled: this.getIndex(item) <= 0,
                click: () => this.activateStart(item)
            },
            {
                id: XcTabMenuEntry.ActivateEnd,
                name: this.i18n.translate('zeta.xc-tab-bar.menu.activate-end'),
                disabled: this.getIndex(item) >= this.items.length - 1,
                click: () => this.activateEnd(item)
            },

            {
                id: XcTabMenuEntry.MoveActions,
                separator: 'above',
                name: this.i18n.translate('zeta.xc-tab-bar.menu.move-actions'),
                children: [
                    {
                        id: XcTabMenuEntry.ActivateLeft,
                        name: this.i18n.translate('zeta.xc-tab-bar.menu.activate-left'),
                        disabled: this.getIndex(item) <= 0,
                        click: () => this.activateLeft(item)
                    },
                    {
                        id: XcTabMenuEntry.ActivateRight,
                        name: this.i18n.translate('zeta.xc-tab-bar.menu.activate-right'),
                        disabled: this.getIndex(item) >= this.items.length - 1,
                        click: () => this.activateRight(item)
                    },
                    {
                        id: XcTabMenuEntry.MoveLeft,
                        separator: 'above',
                        name: this.i18n.translate('zeta.xc-tab-bar.menu.move-left'),
                        disabled: !this.canMoveLeft(item),
                        click: () => this.moveLeft(item)
                    },
                    {
                        id: XcTabMenuEntry.MoveRight,
                        name: this.i18n.translate('zeta.xc-tab-bar.menu.move-right'),
                        disabled: !this.canMoveRight(item),
                        click: () => this.moveRight(item)
                    },
                    {
                        id: XcTabMenuEntry.MoveToStart,
                        separator: 'above',
                        name: this.i18n.translate('zeta.xc-tab-bar.menu.move-start'),
                        disabled: !this.canMoveToStart(item),
                        click: () => this.moveToStart(item)
                    },
                    {
                        id: XcTabMenuEntry.MoveToEnd,
                        name: this.i18n.translate('zeta.xc-tab-bar.menu.move-end'),
                        disabled: !this.canMoveToEnd(item),
                        click: () => this.moveToEnd(item)
                    }
                ]
            }
        ];

        let items = this.filterDisabledEntries(standardItems, item.disabledMenuEntries ?? []);

        items = this.insertCustomMenuItems(items, item.customContextMenuItems);

        return item.contextMenuTransform ? item.contextMenuTransform(items) : items;
    }


    private canMoveToStart(item: XcTabBarItem): boolean {
        return this.getIndex(item) > this.getFirstMovableIndex(item);
    }


    private canMoveToEnd(item: XcTabBarItem): boolean {
        return this.getIndex(item) < this.getLastMovableIndex(item);
    }


    private canMoveLeft(item: XcTabBarItem): boolean {

        const idx = this.getIndex(item);

        if (idx <= 0) {
            return false;
        }

        const target = this.items[idx - 1];

        return target?.pinned === item.pinned;
    }


    private canMoveRight(item: XcTabBarItem): boolean {

        const idx = this.getIndex(item);

        if (idx >= this.items.length - 1) {
            return false;
        }

        const target = this.items[idx + 1];

        return target?.pinned === item.pinned;
    }


    private getClosableTabsLeft(item: XcTabBarItem): XcTabBarItem[] {
        return this.items
            .slice(0, this.getIndex(item))
            .filter(tab => this.isClosable(tab));
    }


    private getClosableTabsRight(item: XcTabBarItem): XcTabBarItem[] {
        return this.items
            .slice(this.getIndex(item) + 1)
            .filter(tab => this.isClosable(tab));
    }


    private getClosableTabsExcept(item: XcTabBarItem): XcTabBarItem[] {
        return this.items.filter(
            tab => tab !== item && this.isClosable(tab)
        );
    }


    private getClosableTabs(): XcTabBarItem[] {
        return this.items.filter(tab => this.isClosable(tab));
    }


    private insertMenuItem(items: XcTabMenuItem[], custom: XcTabContextMenuItem): boolean {

        if (custom.insertBefore !== undefined) {
            const idx = items.findIndex(item => item.id === custom.insertBefore);

            if (idx >= 0) {
                items.splice(idx, 0, custom);
                return true;
            }
        }

        if (custom.insertAfter !== undefined) {
            const idx = items.findIndex(item => item.id === custom.insertAfter);

            if (idx >= 0) {
                items.splice(idx + 1, 0, custom);
                return true;
            }
        }

        for (const item of items) {
            if (item.children && this.insertMenuItem(item.children, custom)) {
                return true;
            }
        }

        return false;
    }


    private insertCustomMenuItems(items: XcTabMenuItem[], customItems?: XcTabContextMenuItem[]): XcTabMenuItem[] {

        const result = [...items];

        customItems?.forEach(custom => {

            const inserted = custom.insertBefore !== undefined || custom.insertAfter !== undefined ? this.insertMenuItem(result, custom) : false;

            if (!inserted) {
                result.push(custom);
            }
        });

        return result;
    }


    drop(event: CdkDragDrop<XcTabBarItem[]>) {

        const dragged = this.items[event.previousIndex];

        const targetIndex = this.normalizeDropIndex(dragged, event.currentIndex);

        const activeTab = this.selection;

        moveItemInArray(this.items, event.previousIndex, targetIndex);

        this.selection = activeTab;
    }


    private normalizeDropIndex(dragged: XcTabBarItem, index: number): number {

        const pinnedCount = this.getPinnedCount();

        return dragged.pinned ? Math.min(index, pinnedCount - 1) : Math.max(index, pinnedCount);
    }


    private getPinnedCount(): number {
        return this.items.filter(item => item.pinned).length;
    }


    private filterDisabledEntries(items: XcTabMenuItem[], disabled: XcTabMenuEntry[]): XcTabMenuItem[] {

        return items
            .filter(item => !disabled.includes(item.id))
            .map(item => ({
                ...item,
                children: item.children ? this.filterDisabledEntries(item.children, disabled) : undefined
            }))
            .filter(item =>
                !item.children || item.children.length > 0
            );
    }
}
