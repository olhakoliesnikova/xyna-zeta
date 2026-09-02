import { AsyncPipe, NgStyle } from '@angular/common';
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
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, inject } from '@angular/core';

import { Subscription } from 'rxjs';
import { first } from 'rxjs/operators';

import { coerceBoolean } from '../../../../base';
import { I18nService } from '../../../../i18n';
import { XcIconButtonComponent } from '../../../xc-button/xc-icon-button.component';
import { XcTooltipDirective } from '../../../xc-tooltip/xc-tooltip.directive';
import { XcStructureTreeNode } from '../../xc-readonly-structure-tree-data-source';
import { ResizeEvent, XcTreeNodeComponent } from '../shared/xc-tree-node.component';


@Component({
    selector: 'xc-tree-item',
    templateUrl: './xc-tree-item.component.html',
    styleUrls: ['./xc-tree-item.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgStyle, XcIconButtonComponent, XcTooltipDirective, AsyncPipe]
})
export class XcTreeItemComponent extends XcTreeNodeComponent implements AfterViewInit, OnDestroy {
    private readonly cdr = inject(ChangeDetectorRef);
    readonly i18n = inject(I18nService);


    static readonly INDENTATION = 20;
    private subscription: Subscription;
    private _node: XcStructureTreeNode;
    private _keepBreaks = false;

    @ViewChild('col0')
    column0: ElementRef;

    @Output()
    readonly expand = new EventEmitter<XcStructureTreeNode>();

    @Output()
    readonly widthChange = new EventEmitter<ResizeEvent>();

    expanded = false;
    indentation = 0;

    @Input()
    firstColumnWidth: number;
    initialWidth: number;


    ngAfterViewInit() {
        // FIXME: This call is very expensive for many items
        this.initialWidth = this.column0.nativeElement.offsetWidth;
        this.widthChange.emit({ node: this.node, width: this.initialWidth });
    }


    ngOnDestroy() {
        this.subscription?.unsubscribe();
        this.widthChange.emit({ node: this.node, width: 0 });
    }


    childWidthChange(event: ResizeEvent) {
        const maxChildWidth = this.updateChildWidth(event.node, event.width);
        this.widthChange.emit({ node: this.node, width: Math.max(maxChildWidth, this.initialWidth) });
    }


    toggle(event?: MouseEvent) {
        if (event?.ctrlKey && !this.expanded) {
            this.expandRecursively();
        } else {
            this.expanded = !this.expanded;
            if (this.expanded && !this.node.complete) {
                this.expand.emit(this.node);
            }
        }
    }

    expandItem() {
        this.expanded = true;
        if (!this.node.complete) {
            this.expand.emit(this.node);
        }
    }


    expandRecursively() {
        this.expanded = true;
        this.expand.emit(this.node);
        setTimeout(
            () => this.node.children?.pipe(first()).subscribe(
                children => children.forEach(
                    child => child.children?.pipe(first()).subscribe(
                        () => setTimeout(() => child.action(), 0)
                    )
                )
            ), 0);
    }


    get value() {
        return this.node.value != null
            ? this.node.value
            : this.node.field.nullRepresentation();
    }


    @Input()
    set node(value: XcStructureTreeNode) {
        this.subscription?.unsubscribe();
        this._node = value;
        this.subscription = this.node?.children.subscribe(
            () => this.cdr.markForCheck()
        );

        // set action callback to toggle node
        this.node.action = () => this.expandRecursively();

        // calculate indentation for this node, depending on its depth
        const depth = (node: XcStructureTreeNode): number => node.parent ? depth(node.parent) + 1 : 1;
        this.indentation = XcTreeItemComponent.INDENTATION * depth(this._node);
    }


    get node(): XcStructureTreeNode {
        return this._node;
    }


    @Input({alias: 'xc-tree-item-keep-breaks', transform: coerceBoolean})
    set keepBreaks(value: boolean) {
        this._keepBreaks = value;
    }


    get keepBreaks(): boolean {
        return this._keepBreaks;
    }
}
