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
import { Component, ContentChildren, ElementRef, HostBinding, HostListener, Input, QueryList, ViewChild } from '@angular/core';
import { MatDrawerContainer, MatDrawerContent, MatDrawer } from '@angular/material/sidenav';

import { coerceBoolean } from '../../base';
import { XcMasterDetailFocusCandidateDirective } from './xc-master-detail-focuscandidate.directive';


type XcMasterDetailSideAreaSize = 'small' | 'golden' | 'half' | 'large' | 'full';
type XcMasterDetailMode = 'side' | 'over';
type XcMasterDetailPosition = 'start' | 'end';


@Component({
    selector: 'xc-master-detail',
    templateUrl: './xc-master-detail.component.html',
    styleUrls: ['./xc-master-detail.component.scss'],
    imports: [MatDrawerContainer, MatDrawerContent, MatDrawer]
})
export class XcMasterDetailComponent {

    @ViewChild(MatDrawerContainer, { static: false })
    private readonly _drawerContainer: MatDrawerContainer;

    @ViewChild(MatDrawerContent, { read: ElementRef, static: false })
    private readonly _drawerContentEl: ElementRef<HTMLElement>;

    private _opened = false;
    private _escapable = false;
    private _sideAreaSize: XcMasterDetailSideAreaSize = 'golden';

    @ContentChildren(XcMasterDetailFocusCandidateDirective, { descendants: true })
    focusCandidates = new QueryList<XcMasterDetailFocusCandidateDirective>();

    @Input('xc-master-detail-mode')
    @HostBinding('attr.detail-mode')
    mode: XcMasterDetailMode = 'side';

    @Input('xc-master-detail-position')
    position: XcMasterDetailPosition = 'end';


    @Input('xc-master-detail-opened')
    set opened(value: boolean) {
        this._opened = value;
    }


    get opened(): boolean {
        return this._opened;
    }


    @Input({alias: 'xc-master-detail-escapable', transform: coerceBoolean})
    set escapable(value: boolean) {
        this._escapable = value;
    }


    get escapable(): boolean {
        return this._escapable;
    }


    @HostListener('window:resize')
    _onResize() {
        this.resize();
    }


    @Input('xc-master-detail-side-area-size')
    @HostBinding('attr.side-area-size')
    set sideAreaSize(value: XcMasterDetailSideAreaSize) {
        this._sideAreaSize = value;
    }


    get sideAreaSize(): XcMasterDetailSideAreaSize {
        return this._sideAreaSize;
    }


    openedChange(event: boolean) {

        if (this._drawerContentEl) {
            if (event && this.sideAreaSize === 'full') {
                this._drawerContentEl.nativeElement.setAttribute('inert', '');
            } else {
                this._drawerContentEl.nativeElement.removeAttribute('inert');
            }
        }

        if (event) {
            const open = this.focusCandidates.find(can => can.moment === 'open');
            if (open) {
                open.focus();
            }
        } else {
            const close = this.focusCandidates.find(can => can.moment === 'close');
            if (close) {
                close.focus();
            }
        }
    }


    resize() {
        // autosize feature of MatDrawContainer can badly effect the overall performance
        // so it is only true until the next change detection, which is triggered by setTimeout
        if (this._drawerContainer) {
            this._drawerContainer.autosize = true;
            // Promise.resolve().then(() => this._drawerContainer.autosize = false);
            window.setTimeout(() => this._drawerContainer.autosize = false, 0);
        }
    }
}
