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
import { Component, HostBinding, HostListener, inject, Input, OnDestroy, OnInit } from '@angular/core';
import { MatNavList } from '@angular/material/list';
import { ActivatedRoute, NavigationEnd, Route, Router } from '@angular/router';

import { coerceBoolean } from '@zeta/base';
import { I18nService, LocaleService } from '@zeta/i18n';

import { Subscription } from 'rxjs';

import { XcThemeableComponent } from '../../shared/xc-themeable.component';
import { xcNavListTranslations_deDE } from './locale/xc-nav-list-translations.de-DE';
import { xcNavListTranslations_enUS } from './locale/xc-nav-list-translations.en-US';
import { XcNavListItemComponent } from './xc-nav-list-item/xc-nav-list-item.component';
import { XcNavListItem, XcNavListOrientation } from './xc-nav-list.types';


/** @fixme Use proper recursive function to avoid the need for this */
interface TwoWayNavListItem {
    item: XcNavListItem;
    parent: TwoWayNavListItem;
}


@Component({
    selector: 'xc-nav-list',
    templateUrl: './xc-nav-list.component.html',
    styleUrls: ['./xc-nav-list.component.scss'],
    imports: [MatNavList, XcNavListItemComponent]
})
export class XcNavListComponent extends XcThemeableComponent implements OnInit, OnDestroy {
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);


    private _items: XcNavListItem[];
    private _navigationSubscription: Subscription;

    @Input('xc-nav-list-orientation')
    orientation = XcNavListOrientation.TOP;

    @Input('xc-nav-list-size')
    size: 'small' | 'medium' | 'large' | 'extra-large' = 'medium';

    /**
     * If set, only the selected item (and its parents) are expanded, the rest will be collapsed automatically
     */
    @Input({alias: 'xc-nav-list-autocollapse', transform: coerceBoolean})
    set autocollapse(value: boolean) {
        this._autocollapse = value;
    }
    private _autocollapse = false;

    /**
     * If set, nav-list shrinks to icons-only if mouse is not over it
     */
    @Input({alias: 'xc-nav-list-shrinkable', transform: coerceBoolean})
    set shrinkable(value: boolean) {
        this._shrinkable = value;
        this.shrink = this._shrinkable;
    }
    get shrinkable(): boolean {
        return this._shrinkable;
    }
    private _shrinkable = false;

    set shrink(value: boolean) {
        this._shrink = value && this.shrinkable;
    }
    get shrink(): boolean {
        return this._shrink;
    }
    private _shrink = false;


    private readonly i18n = inject<I18nService>(I18nService);

    constructor() {
        super();
        this.color = 'primary';
        this.i18n.setTranslations(LocaleService.EN_US, xcNavListTranslations_enUS);
        this.i18n.setTranslations(LocaleService.DE_DE, xcNavListTranslations_deDE);
    }


    get ariaLabel(): string {
        return this.i18n.translate('menu_with_elements', { key: '$0', value: this.items.length.toString() });
    }


    ngOnInit() {
        // subscribing to router event if programmatically changes a route
        this._navigationSubscription = this.router.events.subscribe(event => {
            if (event instanceof NavigationEnd) {
                this._resetNavList();
            }
        });
    }


    ngOnDestroy() {
        // unsubscribe again
        if (this._navigationSubscription) {
            this._navigationSubscription.unsubscribe();
        }
    }


    @Input('xc-nav-list-items')
    set items(value: XcNavListItem[]) {
        this._items = value;
        this._resetNavList();
    }


    get items(): XcNavListItem[] {
        return this._items;
    }


    @HostBinding('attr.orientation')
    get orientationName(): string {
        return XcNavListOrientation[this.orientation];
    }


    private _resetNavList() {

        // collapse all items first
        if (this._autocollapse) {
            const closeItem = (item: XcNavListItem) => {
                item.collapsed = true;
                if (item.children) {
                    item.children.forEach(child => closeItem(child));
                }
            };
            this.items.forEach(item => closeItem(item));
        }


        let tw_item = this._getTwoWayNavListItem();

        if (tw_item) {
            do {
                tw_item.item.collapsed = false;
                tw_item = tw_item.parent;
            } while (tw_item);
        }

    }


    private _getTwoWayNavListItem(): TwoWayNavListItem {

        const link = this._getLink();

        const recFunc = function(item: TwoWayNavListItem, l: string): TwoWayNavListItem {

            if (l && item.item.link === l) {
                return {
                    item: item.item,
                    parent: item.parent
                };
            }

            if (item.item.children && item.item.children.length) {
                for (const child of item.item.children) {
                    const foundItem = recFunc({ item: child, parent: item }, l);
                    if (foundItem) {
                        return foundItem;
                    }
                }
            }
            return null;
        };

        if (!link) {
            return null;
        }

        for (const rootItem of this.items) {
            const foundItem = recFunc({ item: rootItem, parent: null }, link);
            if (foundItem) {
                return foundItem;
            }
        }

        return null;
    }


    /**
     * example:
     * url = localhost:4200/xyna-project/Boilerplate/test/id_02
     * the link in this example would be 'test', when it exist in the routing configurations
     */
    private _getLink(): string {

        const urlParts = this.router.url.split('/');
        let link = urlParts.length >= 2 ? urlParts[urlParts.length - 2] : '';
        const configs = this.route.routeConfig?.children;

        let found = configs
            ? configs.some((value: Route) => value.path === link)
            : false;

        if (!found) {
            link = urlParts[urlParts.length - 1];
            found = configs
                ? configs.some((value: Route) => value.path === link)
                : false;
        }

        return found ? link : '';
    }


    @HostListener('mouseenter')
    mouseEnter() {
        this.shrink = false;
    }


    @HostListener('mouseleave')
    mouseOut() {
        this.shrink = true;
    }


    private waitingForShrink = false;
    focusChange(item: XcNavListItem) {
        if (item) {
            this.shrink = false;
            this.waitingForShrink = false;  // abort shrink, new item has been focused before
        } else {
            this.waitingForShrink = true;   // don't shrink instantly because there might be another item getting focus
            setTimeout(() => {
                if (this.waitingForShrink) {
                    // shrink because there was no other item getting focus
                    this.shrink = true;
                    this.waitingForShrink = false;
                }
            }, 0);
        }
    }
}
