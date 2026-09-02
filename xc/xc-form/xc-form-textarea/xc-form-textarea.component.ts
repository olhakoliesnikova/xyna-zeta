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
import { Component, forwardRef, Input, numberAttribute } from '@angular/core';

import { coerceBoolean } from '@zeta/base';

import { XcFormBaseComponent } from '../xc-form-base/xc-form-base.component';
import { MatFormField, MatLabel, MatError } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { ReactiveFormsModule } from '@angular/forms';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { BooleanKeyframeTrack } from 'three';


@Component({
    selector: 'xc-form-textarea',
    templateUrl: './xc-form-textarea.component.html',
    styleUrls: ['../xc-form-base/xc-form-base.component.scss', './xc-form-textarea.component.scss'],
    providers: [{ provide: XcFormBaseComponent, useExisting: forwardRef(() => XcFormTextareaComponent) }],
    imports: [MatFormField, MatLabel, MatInput, ReactiveFormsModule, CdkTextareaAutosize, MatError]
})
export class XcFormTextareaComponent extends XcFormBaseComponent {
    // @ViewChild(CdkTextareaAutosize) autosize: CdkTextareaAutosize;

    private _minLines = 5;
    private _maxLines = 5;
    private _textareaAutosize = true;

    /**
     * Sets height for the given number of lines
     */
    @Input({alias: 'xc-form-textarea-lines', transform: numberAttribute })
    set lines(value: number) {
        this.minLines = value;
        this.maxLines = value;
        // NOTE: When this textarea is inside a container controlled by *ngIf="!collapsed",
        // the element may not exist in the DOM at the moment this setter (lines) is executed.
        // Calling autosize.resizeToFitContent(true) at this point happens too early,
        // because *ngIf removes the DOM node entirely while the panel is collapsed.
        // As a result, autosize measures a 0×0 element and the textarea appears too small.
        //
        // The (commented out) setTimeout(...) delays the autosize call until the next
        // JavaScript tick, after Angular has re-inserted the textarea into the DOM.
        // Alternatives: avoid *ngIf (use [hidden] instead), or explicitly trigger
        // resizeToFitContent() after the panel is expanded (e.g. via ngZone.onStable
        // or collapsedChange).
        // setTimeout(() => this.autosize.resizeToFitContent(true));
        this._textareaAutosize = true;
    }

    /**
     * sets a minimum of lines in which the component finds
     * the optimized height for its current content
     * Note: works only if "xc-form-textarea-autosize" is true
     */
    @Input({alias: 'xc-form-textarea-minlines', transform: numberAttribute })
    set minLines(value: number) {
        this._minLines = value;
    }

    get minLines(): number {
        return this._minLines;
    }

    /**
     * sets a maximum of lines in which the component finds
     * the optimized height for its current content
     * Note: works only if "xc-form-textarea-autosize" is true
     */
    @Input({alias: 'xc-form-textarea-maxlines', transform: numberAttribute })
    set maxLines(value: number) {
        this._maxLines = value;
    }

    get maxLines(): number {
        return this._maxLines;
    }

    /**
     * de-/activates the search for the optimzed height for
     * the optimzed height for the current content
     * Autosize deactivated makes it easier for custom style to show effect
     */
    @Input({alias: 'xc-form-textarea-autosize', transform: coerceBoolean})
    set textareaAutosize(value: boolean) {
        this._textareaAutosize = value;
    }

    get textareaAutosize(): boolean {
        return this._textareaAutosize;
    }
}
