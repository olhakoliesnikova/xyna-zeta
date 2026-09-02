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
import { Observable, Subject } from 'rxjs';

import { ComponentType } from '@angular/cdk/portal';
import { InjectionToken, Injector, Optional } from '@angular/core';

import { XcMenuItem } from '../';
import { XcDynamicDismissableComponent } from '../shared/xc-dynamic-dismissable.component';
import { XcItem } from '../shared/xc-item';


/** Injection token that can be used to access the data that was passed in to a tab. */
export const XC_TAB_DATA = new InjectionToken<any>('XcTabData');

export enum XcTabMenuEntry {
    Close,
    CloseAll,
    CloseOthers,
    CloseLeft,
    CloseRight,

    Pin,

    ActivateStart,
    ActivateEnd,

    MoveActions,

    ActivateLeft,
    ActivateRight,
    MoveLeft,
    MoveRight,
    MoveToStart,
    MoveToEnd
}

export interface XcTabContextMenuItem extends XcMenuItem {
    insertBefore?: XcTabMenuEntry;
    insertAfter?: XcTabMenuEntry;
}

export interface XcTabBarItem<D = any> extends XcItem {
    tabId?: number;

    disabledMenuEntries?: XcTabMenuEntry[];

    customContextMenuItems?: XcTabContextMenuItem[];

    contextMenuTransform?: (items: XcTabMenuItem[]) => XcMenuItem[];

    component: ComponentType<XcTabComponent<any, any>>;
    pinned?: boolean;
    closable?: boolean;
    closeTooltip?: string;
    data?: D;

    afterActivate?: (index: number) => void;
    afterDeactivate?: (index: number) => void;
}

export interface XcTabMenuItem extends XcMenuItem {
    id?: XcTabMenuEntry;
    children?: XcTabMenuItem[];
}

export interface XcTabBarInterface {
    open(item: XcTabBarItem, beforeItem?: XcTabBarItem, inBackground?: boolean): Observable<XcTabComponent<any, any>>;
    close(item: XcTabBarItem, result?: any, selectItem?: XcTabBarItem): Observable<boolean>;
    initialized(): boolean;
}

export class XcTabRef<R = void> {
    private readonly closeSubject = new Subject<R>();

    constructor(readonly tabBar: XcTabBarInterface, readonly item: XcTabBarItem) {
    }

    openPeer(item: XcTabBarItem, beforeItem?: XcTabBarItem, inBackground?: boolean): Observable<XcTabComponent<any, any>> {
        return this.tabBar.open(item, beforeItem, inBackground);
    }

    close(result?: R, selectItem?: XcTabBarItem): Observable<boolean> {
        return this.tabBar.close(this.item, result, selectItem);
    }

    notifyClose(result?: R) {
        this.closeSubject.next(result);
        this.closeSubject.complete();
    }

    afterClose(): Observable<R | undefined> {
        return this.closeSubject.asObservable();
    }
}


export abstract class XcTabComponent<R = void, D = void> extends XcDynamicDismissableComponent<R, D> {

    private readonly tabRef: XcTabRef<R>;


    constructor(@Optional() readonly injector: Injector) {
        super();
        this.tabRef = injector.get<XcTabRef<R>>(XcTabRef);
    }


    protected getToken(): InjectionToken<D> {
        return XC_TAB_DATA;
    }


    protected get tabBarInterface(): XcTabBarInterface {
        return this.tabRef.tabBar;
    }


    get tabBarItem(): XcTabBarItem {
        return this.tabRef.item;
    }


    dismiss(result?: R, selectItem?: XcTabBarItem) {
        this.tabRef.close(result, selectItem).subscribe();
    }


    afterDismiss(): Observable<R> {
        return this.tabRef.afterClose();
    }


    openPeer(item: XcTabBarItem, beforeItem?: XcTabBarItem, inBackground = false): Observable<XcTabComponent<any, any>> {
        return this.tabRef.openPeer(item, beforeItem, inBackground);
    }
}
