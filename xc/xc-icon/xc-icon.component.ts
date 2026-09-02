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
import { AfterContentInit, Component, ElementRef, HostBinding, Input, OnInit, inject } from '@angular/core';

import { I18nService } from '@zeta/i18n';

import { coerceBoolean } from '../../base';
import { XcThemeableComponent } from '../shared/xc-themeable.component';
import { MatIcon } from '@angular/material/icon';


@Component({
    selector: 'xc-icon',
    templateUrl: './xc-icon.component.html',
    styleUrls: ['./xc-icon.component.scss'],
    imports: [MatIcon]
})
export class XcIconComponent extends XcThemeableComponent implements OnInit, AfterContentInit {
    protected elementRef = inject(ElementRef);
    protected readonly i18n = inject(I18nService);


    private _reverseDirection = false;
    private _iconMaterial = false;
    private _iconSvg = false;
    private _iconStyle: string;
    private _iconName: string;

    private _translate: boolean;

    i18nContext: string;

    @HostBinding('attr.size')
    @Input('xc-icon-size')
    iconSize: 'small' | 'medium' | 'large' | 'extra-large' = 'medium';


    @HostBinding('class.reverse-direction')
    @Input({alias: 'xc-icon-reverse-direction', transform: coerceBoolean})
    set reverseDirection(value: boolean) {
        this._reverseDirection = value;
    }


    get reverseDirection(): boolean {
        return this._reverseDirection;
    }


    @Input({alias: 'xc-icon-material', transform: coerceBoolean})
    set iconMaterial(value: boolean) {
        this._iconMaterial = value;
    }


    get iconMaterial(): boolean {
        return this._iconMaterial;
    }


    @Input({alias: 'xc-icon-svg', transform: coerceBoolean})
    set iconSvg(value: boolean) {
        this._iconSvg = value;
    }


    get iconSvg(): boolean {
        return this._iconSvg;
    }


    @Input('xc-icon-style')
    set iconStyle(value: string) {
        this._iconStyle = value;
    }


    get iconStyle(): string {
        return this._iconStyle || 'xds';
    }


    @HostBinding('attr.name')
    @Input('xc-icon-name')
    set iconName(value: string) {
        this._iconName = value;
    }


    get iconName(): string {
        return this._iconName;
    }


    get iconClass(): string {
        return ['icon', this.iconStyle, this.iconName].join('-');
    }


    ngOnInit() {
        this._translate = !!this.elementRef.nativeElement.textContent;
    }


    ngAfterContentInit() {
        if (this._translate || !!this.elementRef.nativeElement.textContent) {
            const el = this.elementRef.nativeElement.querySelector('span');
            this.i18nContext = this.elementRef.nativeElement.getAttribute('xc-i18n');
            if (el && this.i18nContext != null) {
                el.textContent = this.i18n.translate(this.i18nContext ? this.i18nContext + '.' + el.textContent : el.textContent);
            }
        }
    }
}


export enum XDSIconName {
    ACCORDION = 'accordion',
    ADD = 'add',
    ARROWDOWN = 'arrowdown',
    ARROWLEFT = 'arrowleft',
    ARROWRIGHT = 'arrowright',
    ARROWUP = 'arrowup',
    CALENDAR = 'calendar',
    CHECKED = 'checked',
    CLOSE = 'close',
    COPY = 'copy',
    DELETE = 'delete',
    EDIT = 'edit',
    EXTERNAL = 'external',
    FILE = 'file',
    FILEEXPORT = 'fileexport',
    FILEIMPORT = 'fileimport',
    FILTER = 'filter',
    FILTERCLEAR = 'filterclear',
    FULLSCREEN = 'fullscreen',
    HELP = 'help',
    INFO = 'info',
    LOADINGSPINNER = 'loadingspinner',
    MAXIMIZE = 'maximize',
    MENU = 'menu',
    MESSAGE = 'message',
    MINIMIZE = 'minimize',
    MSGALARM = 'msgalarm',
    MSGINFO = 'msginfo',
    MSGMESSAGE = 'msgmessage',
    MSGREADY = 'msgready',
    MSGWARNING = 'msgwarning',
    PASTE = 'paste',
    PORT = 'port',
    PRINT = 'print',
    RELOAD = 'reload',
    SEARCH = 'search',
    SETTINGS = 'settings',
    SUBNAVEXPAND = 'subnavexpand',
    TIME = 'time',
    USER = 'user'
}
