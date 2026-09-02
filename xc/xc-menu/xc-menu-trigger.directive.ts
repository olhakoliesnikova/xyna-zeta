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
import { take } from 'rxjs';

import { FlexibleConnectedPositionStrategy } from '@angular/cdk/overlay';
import { Directive, ElementRef, EventEmitter, HostBinding, HostListener, Input, Output } from '@angular/core';
import { MatMenu, MatMenuTrigger } from '@angular/material/menu';

import { XcMenu, XcMenuComponentInterface } from './xc-menu.types';


@Directive({ selector: '[xc-menu-trigger]', exportAs: 'xcMenuTrigger' })
export class XcMenuTriggerDirective extends MatMenuTrigger {

    private outsideClickListener?: EventListener;
    private previousFocusedElement?: HTMLElement;

    @HostBinding('attr.aria-haspopup')
    readonly ariaHasPopup = true;

    @Output('xc-menu-trigger')
    readonly xcMenuTriggerEmitter = new EventEmitter();


    @Input('xc-menu-trigger')
    set xcMenuTrigger(value: XcMenuComponentInterface) {
        this.menu = value?.menu;
    }


    @HostListener('keydown.space')
    @HostListener('keydown.enter')
    @HostListener('mousedown')
    trigger() {
        this.xcMenuTriggerEmitter.emit();
    }


    get xcMenu(): XcMenu {
        return this.menu as XcMenu;
    }


    get hasMenuItems(): boolean {
        return !!this.xcMenu && this.xcMenu._allItems.length > 0;
    }


    _handleKeydown(event: KeyboardEvent) {
        if (this.hasMenuItems) {
            super._handleKeydown(event);
        }
    }


    _handleMousedown(event: MouseEvent) {
        if (this.hasMenuItems) {
            super._handleMousedown(event);
        }
    }


    _handleClick(event: MouseEvent) {
        if (this.hasMenuItems) {
            super._handleClick(event);
        }
    }


    // override private function
    [(() => '_setPosition')()](menu: MatMenu, positionStrategy: FlexibleConnectedPositionStrategy) {
        // super call

        super['_setPosition'].call(this, menu, positionStrategy);

        if (this.triggersSubmenu()) {
            // affects nested menus only
            // adjust menu's offset-y for a 1px border added to its panel and an adjusted 0px padding of its content
            positionStrategy._preferredPositions.forEach(preferredPosition => {
                const aboveFactor = preferredPosition.originY === 'bottom' ? 1 : -1;
                preferredPosition.offsetY += aboveFactor * (1 - 8);
            });
        } else {
            // affects root menus only

            const rect = (this['_element'] as ElementRef).nativeElement.getBoundingClientRect();
            positionStrategy._preferredPositions.forEach(preferredPosition => preferredPosition.offsetX = 0);
            // adjust menu's offset-x for the width of the trigger's element
            if (this.xcMenu.xNexttoTrigger) {
                positionStrategy._preferredPositions.forEach(preferredPosition => {
                    const afterFactor = preferredPosition.originX === 'start' ? 1 : -1;
                    preferredPosition.offsetX += afterFactor * rect.width;
                });
            }
            // adjust menu's offset-x/offset-y in order to center arrow (since the width of the menu can't be determined here,
            // we'll settle for the constant height of a menu item to position arrow in both cases, horizontally and vertically
            if (this.xcMenu.withArrow) {
                const itemHeight = 50;
                if (!this.xcMenu.xNexttoTrigger) {
                    positionStrategy._preferredPositions.forEach(preferredPosition => {
                        const beforeFactor = preferredPosition.originX === 'end' ? 1 : -1;
                        preferredPosition.offsetX += beforeFactor * ((1 + itemHeight - rect.width) / 2);
                    });
                }
                if (!this.xcMenu.yNexttoTrigger) {
                    positionStrategy._preferredPositions.forEach(preferredPosition => {
                        const aboveFactor = preferredPosition.originY === 'bottom' ? 1 : -1;
                        preferredPosition.offsetY += aboveFactor * ((1 + itemHeight - rect.height) / 2);
                    });
                }
            }
            // add custom offsets
            positionStrategy._preferredPositions.forEach(preferredPosition => {
                preferredPosition.offsetX += this.xcMenu.xOffset;
                preferredPosition.offsetY += this.xcMenu.yOffset;
            });
        }
    }


    openAt(x: number, y: number): void {

        this.restoreFocus = false;
        this.previousFocusedElement = document.activeElement as HTMLElement;

        const element = (this['_element'] as ElementRef).nativeElement as HTMLElement;

        // Move the hidden trigger element to the requested screen position.
        // The Material overlay is positioned relative to this element.
        element.style.position = 'fixed';
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;

        // Context menus should not block subsequent right-clicks with a backdrop.
        const previous = this.menu.hasBackdrop;
        this.menu.hasBackdrop = false;

        // Clean up any listener from a previous context menu invocation.
        if (this.outsideClickListener) {
            document.removeEventListener('mousedown', this.outsideClickListener, true);
        }

        // Manually close the menu when clicking outside, since the backdrop is disabled.
        this.outsideClickListener = (event: MouseEvent) => {
            const overlayContainer = document.querySelector('.cdk-overlay-container');

            if (overlayContainer && !overlayContainer.contains(event.target as Node)) {
                document.removeEventListener('mousedown', this.outsideClickListener, true);

                this.outsideClickListener = undefined;

                this.closeMenu();
            }
        };

        this.openMenu();

        this.menuClosed.pipe(take(1)).subscribe(() => {

            // Restore original menu configuration and remove temporary listeners.
            this.menu.hasBackdrop = previous;

            if (this.outsideClickListener) {
                document.removeEventListener('mousedown', this.outsideClickListener, true);

                this.outsideClickListener = undefined;
            }

            if (this.previousFocusedElement?.isConnected) {
                this.previousFocusedElement.focus();
            }
        });

        // Force overlay repositioning after moving the hidden trigger element.
        requestAnimationFrame(() => {
            this['_overlayRef']?.updatePosition();
        });

        // Register outside-click handling after the current event has finished.
        setTimeout(() => {
            document.addEventListener('mousedown', this.outsideClickListener, true);
        });
    }
}
