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
import { Observable, of, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { NestedTreeControl } from '@angular/cdk/tree';
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostBinding, inject, Input, NgZone, OnDestroy } from '@angular/core';
import { MatNestedTreeNode, MatTree, MatTreeNodeDef, MatTreeNodeOutlet, MatTreeNodeToggle } from '@angular/material/tree';

import { coerceBoolean } from '../../base';
import { I18nService, LocaleService, XcI18nContextDirective, XcI18nPipe } from '../../i18n';
import { XcIconButtonComponent } from '../xc-button/xc-icon-button.component';
import { XcTemplateComponent } from '../xc-template/xc-template.component';
import { XcTooltipDirective } from '../xc-tooltip/xc-tooltip.directive';
import { xcTreeTranslations_deDE } from './locale/xc-translations.de-DE';
import { xcTreeTranslations_enUS } from './locale/xc-translations.en-US';
import { XcTreeDataSource, XcTreeNode } from './xc-tree-data-source';


export interface XcTreeObserver {
    /**
     * Make a specific node readonly.
     * @param node Node to set readonly state for
     * @param defaultReadonly Default readonly state
     */
    readonlyNode?(node: XcTreeNode, defaultReadonly: boolean): boolean;

    /**
     * Make a specific node disabled.
     * Note: This doesn't work vice versa - a node that is created disabled might also miss accessors to modify it.
     * So a disabled node will stay disabled despite returning *false* here.
     * @param node Node to set disabled state for
     * @param defaultDisabled Default disabled state
     */
    disableNode?(node: XcTreeNode, defaultDisabled: boolean): boolean;

    /**
     * Overwrite the node's visibility.
     * Note: If this function is defined, it completely overwrites the node's default visibility
     * @param node Node to set visibility for
     * @param defaultHidden Default hidden state
     */
    hideNode?(node: XcTreeNode, defaultHidden: boolean): boolean;

    /**
     * Disable a node's expandability deduced by the node having children or not
     * Note: This doesn't work vice versa - a node that is created non-expandable cannot be made expandable.
     * @param node Node to set expandability for
     */
    disableExpandability?(node: XcTreeNode): boolean;

    /**
     * Can be used to manipulate the properties of a given node, i.e. its tooltip or its classes.
     */
    visitNode?(node: XcTreeNode): void;
}



@Component({
    selector: 'xc-tree',
    templateUrl: './xc-tree.component.html',
    styleUrls: ['./xc-tree.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatTree, XcI18nContextDirective, XcI18nPipe, MatTreeNodeDef, MatNestedTreeNode, XcIconButtonComponent, MatTreeNodeToggle, XcTooltipDirective, NgClass, XcTemplateComponent, MatTreeNodeOutlet]
})
export class XcTreeComponent implements OnDestroy {
    private readonly cdRef = inject(ChangeDetectorRef);
    private readonly _i18n = inject(I18nService);
    private readonly zone = inject(NgZone);


    private _allowSelect = false;
    private _multiSelect = false;
    private _controlPressed = false;
    private _dataSource: XcTreeDataSource<XcTreeNode>;
    private _dataSourceSubscriptions = new Array<Subscription>();
    private readonly _treeControl = new NestedTreeControl<XcTreeNode>(node => this.getNodeChildren(node));

    private readonly keyCatcherOnKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Control' && !this._controlPressed) {
            this._controlPressed = true;
            this.cdRef.detectChanges();
        }
    };

    private readonly keyCatcherOnKeyup = (e: KeyboardEvent) => {
        if (e.key === 'Control') {
            this._controlPressed = false;
            this.cdRef.detectChanges();
        }
    };

    @Input('xc-tree-observer')
    observer: XcTreeObserver;

    @Input('xc-tree-autoexpand')
    autoExpand: 'first' | 'all';


    constructor() {
        this._i18n.setTranslations(LocaleService.EN_US, xcTreeTranslations_enUS);
        this._i18n.setTranslations(LocaleService.DE_DE, xcTreeTranslations_deDE);

        this.zone.runOutsideAngular(() => {
            document.body.addEventListener('keydown', this.keyCatcherOnKeydown);
            document.body.addEventListener('keyup', this.keyCatcherOnKeyup);
        });
    }


    private unsubscribeDataSource() {
        this._dataSourceSubscriptions.forEach(subscription => subscription.unsubscribe());
        this._dataSourceSubscriptions = [];
    }


    private getNodeChildren(node: XcTreeNode): Observable<XcTreeNode[]> {
        if (this.dataSource) {
            return this.dataSource.getNodeChildren(node);
        }
        return of([]);
    }


    ngOnDestroy(): void {
        this.unsubscribeDataSource();
        this.zone.runOutsideAngular(() => {
            document.body.removeEventListener('keydown', this.keyCatcherOnKeydown);
            document.body.removeEventListener('keyup', this.keyCatcherOnKeyup);
        });
    }


    get i18n(): I18nService {
        // use i18n service from data source, if available
        if (this.dataSource && this.dataSource.i18n) {
            return this.dataSource.i18n;
        }
        // use zeta's i18n service
        return this._i18n;
    }

    get translateLabels(): boolean {
        return this.dataSource && this.dataSource.translateLabels;
    }


    @HostBinding('class.allowselect')
    @Input({alias: 'xc-tree-allowselect', transform: coerceBoolean})
    set allowSelect(value: boolean) {
        this._allowSelect = value;
    }


    get allowSelect(): boolean {
        return this._allowSelect;
    }


    @Input({alias: 'xc-tree-multiselect', transform: coerceBoolean})
    set multiSelect(value: boolean) {
        this._multiSelect = value;
    }


    get multiSelect(): boolean {
        return this._multiSelect;
    }


    @Input('xc-tree-datasource')
    set dataSource(value: XcTreeDataSource<any>) {
        this.unsubscribeDataSource();
        this._dataSource = value;
        if (this.dataSource) {
            // subscribe to mark for changes
            this._dataSourceSubscriptions.push(
                this.dataSource.markForChange.subscribe(() => {
                    this.cdRef.markForCheck();
                })
            );
            // subscribe to data changes
            this._dataSourceSubscriptions.push(
                this.dataSource.dataChange.pipe<XcTreeNode[]>(
                    filter(nodes => this.autoExpand && nodes.length > 0)
                ).subscribe(nodes =>
                    nodes.forEach(node => {
                        if (this.autoExpand === 'first') {
                            this.treeControl.expand(node);
                        } else if (this.autoExpand === 'all') {
                            const expandChildren = (parentNode: XcTreeNode) => {
                                this.treeControl.expand(parentNode);
                                this._dataSourceSubscriptions.push(parentNode.children.pipe(filter(children => children.length > 0)).subscribe(children =>
                                    children.forEach(child => expandChildren(child))
                                ));
                            };
                            expandChildren(node);
                        }
                    })
                )
            );
        }
    }


    get dataSource(): XcTreeDataSource<any> {
        return this._dataSource;
    }


    get treeControl(): NestedTreeControl<XcTreeNode> {
        return this._treeControl;
    }


    @HostBinding('class.readonly-mode')
    get readonlyMode(): boolean {
        return this.dataSource && this.dataSource.readonlyMode;
    }


    get recursiveToggling() {
        return this._controlPressed;
    }


    getTemplateAriaLabelByNode(node: XcTreeNode): string {
        return this.i18n.translate(node.name);
    }


    isNodeReadonly(node: XcTreeNode): boolean {
        const readonly = node.readonly && !this.readonlyMode;
        return readonly || this.observer && this.observer.readonlyNode && this.observer.readonlyNode(node, readonly);
    }

    isNodeDisabled(node: XcTreeNode): boolean {
        const disabled = node.disabled && !this.readonlyMode;
        return disabled || this.observer && this.observer.disableNode && this.observer.disableNode(node, disabled);
    }


    isNodeVisible(node: XcTreeNode): boolean {
        return !this.isNodeHidden(node);
    }


    isNodeHidden(node: XcTreeNode): boolean {
        const readonlyHidden = this.dataSource && this.dataSource.readonlyHidden;
        const parentHidden = node.parent && this.isNodeHidden(node.parent);
        const hidden = readonlyHidden && (node.readonly || parentHidden);

        // observer can overwrite the default visibility
        if (this.observer && this.observer.hideNode) {
            return this.observer.hideNode(node, hidden);
        }
        return hidden;
    }


    visitNode(node: XcTreeNode) {
        if (this.observer && this.observer.visitNode) {
            return this.observer.visitNode(node);
        }
    }


    isNodeLimit(node: XcTreeNode): boolean {
        return node.parent && node.parent.limit >= 0 && node.limit < 0;
    }


    isNodeExpandable(node: XcTreeNode): boolean {
        if (!node.fixed && (!this.observer || !this.observer.disableExpandability || !this.observer.disableExpandability(node))) {
            const children = node.children ? node.children.getValue() : [];
            return children.some(child => this.isNodeVisible(child));
        }
        return false;
    }


    isNodeExpanded(node: XcTreeNode): boolean {
        return this.treeControl.isExpanded(node);
    }


    isNodeCollapsed(node: XcTreeNode): boolean {
        return !this.isNodeExpanded(node);
    }


    isNodeSelected(node: XcTreeNode): boolean {
        return this.dataSource && this.dataSource.selectionModel.isSelected(node);
    }


    selectNode(node: XcTreeNode, ctrl: boolean) {
        if (this.dataSource && this.allowSelect) {
            this.dataSource.selectionModel.combineOperations(() => {
                if (!(ctrl && (this.dataSource.selectionModel.isSelected(node) || this.multiSelect))) {
                    this.dataSource.selectionModel.clear();
                }
                this.dataSource.selectionModel.toggle(node);
            });
        }
    }


    unlimitNode(node: XcTreeNode) {
        node.action();
    }


    getTooltip(node: XcTreeNode): string {
        return node.tooltip || '';
    }


    getAriaLevel(node: XcTreeNode): number {
        let lvl = 1;
        let parent = node.parent;
        while (parent) {
            lvl++;
            parent = parent.parent;
        }
        return lvl;
    }


    getAriaSetsize(node: XcTreeNode): number {
        let size = 1;
        if (node.parent) {
            node.parent.children.subscribe(children => size = children.length);
        }
        return size;
    }


    getAriaPosinset(node: XcTreeNode): number {
        let pos = 1;
        if (node.parent) {

            node.parent.children.subscribe(children => children.some((child, i) => {
                if (child.name === node.name) {
                    pos = i + 1;
                    return true;
                }
            }));
        }
        return pos;
    }
}
