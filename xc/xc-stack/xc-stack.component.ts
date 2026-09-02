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
import { AfterViewInit, Component, ElementRef, Input, OnDestroy, QueryList, ViewChildren, inject } from '@angular/core';

import { coerceBoolean, retrieveFocusableElements, scrollToElement } from '@zeta/base';
import { I18nService } from '@zeta/i18n';

import { BehaviorSubject, combineLatest, Observable, of, Subject, Subscription } from 'rxjs';
import { filter, map, switchMapTo } from 'rxjs/operators';

import { XcStackDataSource } from './xc-stack-data-source';
import { XcStackItemInterface, XcStackObserver } from './xc-stack-item/xc-stack-item';
import { XcTemplateComponent } from '../xc-template/xc-template.component';
import { XcButtonComponent } from '../xc-button/xc-button.component';
import { XcTooltipDirective } from '../xc-tooltip/xc-tooltip.directive';


export interface XcStackInterface {
    open(stackItem: XcStackItemInterface): Observable<XcStackItemInterface>;
    close(stackItem: XcStackItemInterface): Observable<boolean>;
    isActive(): boolean;
    activeChange(): Observable<boolean>;
}


@Component({
    selector: 'xc-stack',
    templateUrl: './xc-stack.component.html',
    styleUrls: ['./xc-stack.component.scss'],
    imports: [XcTemplateComponent, XcButtonComponent, XcTooltipDirective]
})
export class XcStackComponent implements XcStackInterface, AfterViewInit, OnDestroy {
    private readonly i18n = inject(I18nService);


    private _dataSource: XcStackDataSource;
    readonly breadcrumbLabels: Map<XcStackItemInterface, string> = new Map();

    /**
     * Active state of stack. Is passed to each stack item.
     * Can be used to tell all stack items to halt expensive processes while inactive
     */
    private readonly _activeSubject = new BehaviorSubject<boolean>(true);
    private _openedStackItemSubject: Subject<XcStackItemInterface>;
    private dataSourceSubscription: Subscription;
    private readonly breadcrumbSubscriptons: Subscription[] = [];

    @ViewChildren('items') itemList: QueryList<ElementRef>;


    ngAfterViewInit() {
        this.itemList.changes.subscribe(() => {
            // scroll to last item if item list changes
            this.scrollToStackItem(this._dataSource.stackItems.length - 1);

            // if an item has been opened, it's open now - so complete waiting subject
            if (this._openedStackItemSubject) {
                this._openedStackItemSubject.next(this._dataSource.last());
                this._openedStackItemSubject.complete();
                this._openedStackItemSubject = null;
            }
        });
    }


    ngOnDestroy() {
        this.dataSourceSubscription?.unsubscribe();
        this.breadcrumbSubscriptons.forEach(subscription => subscription.unsubscribe());
    }


    get dataSource(): XcStackDataSource {
        return this._dataSource;
    }


    @Input('xc-stack-items')
    set dataSource(values: XcStackDataSource) {
        this.dataSourceSubscription?.unsubscribe();
        this._dataSource = values;

        this.dataSourceSubscription = this.dataSource.stackItemsChange.subscribe(() => {
            this.breadcrumbLabels.clear();
            this.breadcrumbSubscriptons.forEach(subscription => subscription.unsubscribe());
            this.dataSource.stackItems.forEach((item: XcStackItemInterface & XcStackObserver, index: number) => {
                item.setStack(this);

                this.breadcrumbSubscriptons.push(item.getBreadcrumbLabel().subscribe(label =>
                    this.breadcrumbLabels.set(item, label || this.i18n.translate('Item') + ' ' + (index + 1))
                ));
            });
        });
    }


    @Input({alias: 'xc-stack-active', transform: coerceBoolean})
    set active(value: boolean) {
        this._activeSubject.next(value);
    }


    isActive(): boolean {
        return this._activeSubject.value;
    }


    activeChange(): Observable<boolean> {
        return this._activeSubject.asObservable();
    }


    open(stackItem: XcStackItemInterface & XcStackObserver): Observable<XcStackItemInterface> {
        this.dataSource.add(stackItem);

        for (const observer of this.dataSource.stackItems) {
            observer.afterOpen(stackItem);
        }

        this._openedStackItemSubject = new Subject<XcStackItemInterface>();
        return this._openedStackItemSubject;
    }


    close(stackItem: XcStackItemInterface & XcStackObserver): Observable<boolean> {
        const stackItems = this.dataSource.stackItems;
        const index = stackItems.findIndex(item => item === stackItem);

        if (index < 0) {
            return of(false);
        }

        const closeCurrent = (): Observable<boolean> =>
            // ask observers if there's anyone that doesn't agree with closing this item
            combineLatest(stackItems.map(observer => observer.beforeClose ? observer.beforeClose(stackItem) : of(true))).pipe(
                map(results => {
                    const allowed = results.indexOf(false) < 0;
                    if (allowed) {
                        this.dataSource.remove(stackItem);
                        stackItem.afterClose(stackItem);
                    }
                    return allowed;
                })
            );

        // if stack item is not last in stack, first close item behind
        if (index < stackItems.length - 1) {
            return this.close(stackItems[index + 1]).pipe(
                filter(closedOther => closedOther),
                switchMapTo(closeCurrent())
            );
        }
        return closeCurrent();
    }


    scrollToStackItem(idx: number) {
        const elementToScrollInto = this.itemList.find((_, index) => index === idx);

        // focus first focusable element inside the stack item
        const focusItem = () => {
            const focusable = retrieveFocusableElements(elementToScrollInto.nativeElement);
            if (focusable.length > 0 && focusable[0]) {
                focusable[0].focus();
            }
        };

        if (elementToScrollInto) {
            scrollToElement(elementToScrollInto.nativeElement).subscribe(() => focusItem());
            elementToScrollInto.nativeElement.classList.add('new');
        }
    }


    ariaBreadcrumbLabel(stackItem: XcStackItemInterface): string {
        return this.i18n.translate('Select breadcrumb for $0', { key: '$0', value: this.breadcrumbLabels.get(stackItem) });
    }
}
