
import { Observable } from 'rxjs';

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
import { Component, HostListener, inject, InjectionToken, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { XcDynamicDismissableComponent } from '../shared/xc-dynamic-dismissable.component';
import { XcDialogWrapperComponent } from './xc-dialog-wrapper.component';


@Component({
    template: ''
})

export abstract class XcDialogComponent<R = void, D = void>
    extends XcDynamicDismissableComponent<R, D> {

    private readonly dialogRef = inject(MatDialogRef<any>);

    @ViewChild(XcDialogWrapperComponent)
    private wrapper: XcDialogWrapperComponent;

    protected _maximized = false;

    constructor() {
        super();
    }


    ngAfterViewInit() {
        if (this.wrapper) {
            this.wrapper.maximizedChange.subscribe(value => {
                this._maximized = value;
            });
        }
    }

    protected getToken(): InjectionToken<D> {
        return MAT_DIALOG_DATA;
    }

    @HostListener('keydown.Escape')
    dismiss(result?: R) {
        this.dialogRef.close(result);
    }

    afterDismiss(): Observable<R> {
        return this.dialogRef.afterClosed();
    }


    toggleMaximize(event: Event) {
        this._maximized = !this._maximized;

        if (this.wrapper) {
            this.wrapper.maximized = this._maximized;
        }

        event.preventDefault();
    }
}
