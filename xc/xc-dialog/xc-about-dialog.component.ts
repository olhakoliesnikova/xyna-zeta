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
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';

import { XcI18nContextDirective, XcI18nPipe, XcI18nTranslateDirective } from '../../i18n';
import { XcButtonComponent } from '../xc-button/xc-button.component';
import { XcDialogOptions, XcDialogWrapperComponent } from './xc-dialog-wrapper.component';
import { XcDialogComponent } from './xc-dialog.component';


export interface XcAboutDialogConfig {
    title: string;
    copyright: string;
    versions: string;
    detailsLink?: string;
    draggable: boolean;
    resizable: boolean;
    maximizable: boolean;
    maximized: boolean;
    dialogOptions?: XcDialogOptions;
}


@Component({
    templateUrl: './xc-about-dialog.component.html',
    styleUrls: ['./xc-about-dialog.component.scss'],
    imports: [XcDialogWrapperComponent, XcI18nContextDirective, XcI18nTranslateDirective, XcI18nPipe, XcButtonComponent]
})
export class XcAboutDialogComponent extends XcDialogComponent<void, XcAboutDialogConfig> {
    protected readonly http = inject(HttpClient);

    license = '';
    details = false;


    constructor() {
        super();

        this.http.get(this.injectedData.detailsLink, { responseType: 'text' }).subscribe(
            result => this.license = result
        );
    }


    toggleDetails() {
        this.details = !this.details;
    }
}
