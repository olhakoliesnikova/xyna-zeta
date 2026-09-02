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
import { Component, HostBinding, inject, Input } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatRipple } from '@angular/material/core';

import { coerceBoolean } from '../../base';
import { I18nService } from '../../i18n/i18n.service';
import { XcIconComponent } from '../xc-icon/xc-icon.component';
import { XcProgressBarComponent } from '../xc-progress-bar/xc-progress-bar.component';
import { XcButtonBaseComponent } from './xc-button-base.component';


@Component({
    selector: 'xc-icon-button',
    templateUrl: './xc-icon-button.component.html',
    styleUrls: ['./xc-button-base.component.scss', './xc-icon-button.component.scss'],
    imports: [MatIconButton, MatRipple, XcIconComponent, XcProgressBarComponent]
})
export class XcIconButtonComponent extends XcButtonBaseComponent {
    private readonly i18nService = inject(I18nService);


    private _iconMaterial = false;
    private _iconSvg = false;

    @Input('xc-icon-name')
    iconName: string;

    @Input('xc-icon-style')
    iconStyle: string;

    @HostBinding('attr.size')
    @Input('xc-icon-size')
    iconSize: 'small' | 'medium' | 'large' | 'extra-large' = 'medium';


    protected setAriaLabel(value: string) {
        super.setAriaLabel(value || (this.iconName ? this.i18nService.translate(this.iconName) : ''));
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
}
