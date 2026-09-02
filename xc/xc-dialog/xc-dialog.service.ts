import { filter, map } from 'rxjs/operators';

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
import { ComponentType } from '@angular/cdk/portal';
import { inject, Injectable } from '@angular/core';
import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { Xo } from '@zeta/api';

import { AuthEventService } from '../../auth/auth-event.service';
import { I18nService } from '../../i18n';
import { XcDialogDefinitionComponent } from '../xc-form/definitions/xc-dialog-definition/xc-dialog-definition.component';
import { XoDefinition, XoDefinitionBundle } from '../xc-form/definitions/xo/base-definition.model';
import { xcDialogTranslations_deDE } from './locale/xc-dialog-translations.de-DE';
import { xcDialogTranslations_enUS } from './locale/xc-dialog-translations.en-US';
import { XcAboutDialogComponent, XcAboutDialogConfig } from './xc-about-dialog.component';
import { XcConfirmDialogComponent } from './xc-confirm-dialog.component';
import { XcDialogOptions } from './xc-dialog-wrapper.component';
import { XcDialogComponent } from './xc-dialog.component';
import { XcInfoDialogComponent } from './xc-info-dialog.component';
import { XcMessageDialogComponent } from './xc-message-dialog.component';


@Injectable({ providedIn: 'root' })
export class XcDialogService {
    private readonly dialog = inject(MatDialog);
    protected readonly i18n = inject(I18nService);

    static defaultErrorTitle = 'zeta.xc-dialog.info-dialog.error-header';

    private readonly dialogRefStack = new Array<MatDialogRef<any>>();


    constructor() {
        const authEventService = inject(AuthEventService);

        this.i18n.setTranslations('de-DE', xcDialogTranslations_deDE);
        this.i18n.setTranslations('en-US', xcDialogTranslations_enUS);

        authEventService.didLogout.subscribe(() => {
            // close all opened dialogs in reverse order (top to bottom)
            this.dialogRefStack.reverse().forEach(dialogRef => {
                dialogRef.close();
            });
            // clear stack
            this.dialogRefStack.splice(0);
        });
    }


    private openDialog<T extends XcDialogComponent<any, any>>(componentType: ComponentType<T>, data: any, ariaLabel?: string, panelClass?: string, overrideConfig?: MatDialogConfig): MatDialogRef<T, any> {
        const defaultConfig: MatDialogConfig = {
            data,
            panelClass,
            role: 'dialog',
            disableClose: true,
            autoFocus: true,
            ariaLabel: ariaLabel,
            enterAnimationDuration: '0',
            exitAnimationDuration: '0',
            // width, height, ...

            maxWidth: '100vw',
            maxHeight: '100vh'
        };

        if (overrideConfig) {
            Object.keys(overrideConfig).forEach(key => defaultConfig[key] = overrideConfig[key]);
        }

        // open dialog and store ref
        const dialogRef = this.dialog.open(componentType, defaultConfig);
        this.dialogRefStack.push(dialogRef);

        // subscribe to closed event in order to remove ref
        dialogRef.afterClosed().pipe(
            map(() => this.dialogRefStack.indexOf(dialogRef)),
            filter(idx => idx !== -1)
        ).subscribe(
            idx => this.dialogRefStack.splice(idx, 1)
        );

        return dialogRef;
    }


    private openMessageDialog<T extends XcMessageDialogComponent<any, any>>(componentType: ComponentType<T>, title: string, message: string, data: any, ariaLabel?: string, details?: string, draggable = false, resizable = false, maximizable = false, maximized = false, dialogOptions: XcDialogOptions = {}, overrideConfig?: MatDialogConfig): T {
        const dialogRef = this.openDialog(componentType, data, ariaLabel, '', overrideConfig);
        dialogRef.componentInstance.title = title;
        dialogRef.componentInstance.message = message;
        dialogRef.componentInstance.details = details;
        dialogRef.componentInstance.draggable = draggable;
        dialogRef.componentInstance.resizable = resizable;
        dialogRef.componentInstance.maximizable = maximizable;
        dialogRef.componentInstance.maximized = maximized;

        dialogRef.componentInstance.dialogOptions = dialogOptions;
        return dialogRef.componentInstance;
    }


    confirm(title: string, message: string, ariaLabel?: string, draggable = false, resizable = false, maximizable = false, maximized = false, dialogOptions: XcDialogOptions = {}): XcConfirmDialogComponent {
        const overrideConfig: MatDialogConfig = {
            ariaDescribedBy: 'xc-confirm-dialog-message-container',
            role: 'dialog'
        };
        return this.openMessageDialog(XcConfirmDialogComponent, title, message, null, ariaLabel, null, draggable, resizable, maximizable, maximized, dialogOptions, overrideConfig);
    }


    info(title: string, message: string, ariaLabel?: string, details?: string, draggable = false, resizable = false, maximizable = false, maximized = false, dialogOptions: XcDialogOptions = {}): XcInfoDialogComponent {
        const overrideConfig: MatDialogConfig = {
            ariaDescribedBy: 'xc-info-dialog-message-container',
            role: 'dialog'
        };
        return this.openMessageDialog(XcInfoDialogComponent, title, message, null, ariaLabel, details, draggable, resizable, maximizable, maximized, dialogOptions, overrideConfig);
    }


    error(message: string, ariaLabel?: string, stackTrace?: string, draggable = false, resizable = false, maximizable = false, maximized = false, dialogOptions: XcDialogOptions = {}): XcInfoDialogComponent {
        const overrideConfig: MatDialogConfig = {
            ariaDescribedBy: 'xc-info-dialog-message-container',
            role: 'alertdialog'
        };
        return this.openMessageDialog(XcInfoDialogComponent, this.i18n.translate(XcDialogService.defaultErrorTitle), message, null, ariaLabel, stackTrace, draggable, resizable, maximizable, maximized, dialogOptions, overrideConfig);
    }


    about(title: string, copyright: string, versions: string, detailsLink?: string, ariaLabel?: string, draggable = false, resizable = false, maximizable = false, maximized = false, dialogOptions: XcDialogOptions = {}): XcAboutDialogComponent {
        const overrideConfig: MatDialogConfig = {
            ariaDescribedBy: 'xc-about-dialog-message-container',
            role: 'dialog'
        };
        const config: XcAboutDialogConfig = {
            title: title,
            copyright: copyright,
            versions: versions,
            detailsLink: detailsLink,
            dialogOptions: dialogOptions,
            draggable: draggable,
            resizable: resizable,
            maximizable: maximizable,
            maximized: maximized
        };
        return this.openDialog(XcAboutDialogComponent, config, ariaLabel, '', overrideConfig).componentInstance;
    }


    definition(definition: XoDefinition, data: Xo[], ariaLabel?: string): XcDialogDefinitionComponent {
        const dialogData: XoDefinitionBundle = {
            definition: definition,
            data: data
        };
        return this.openDialog(XcDialogDefinitionComponent, dialogData, ariaLabel, '').componentInstance;
    }


    custom<R = any, D = any, T extends XcDialogComponent<R, D> = XcDialogComponent<R, D>>(componentType: ComponentType<T>, data: D = null, ariaLabel?: string, panelClass?: string): T {
        return this.openDialog(componentType, data, ariaLabel, panelClass).componentInstance;
    }


    isDialogOpen(): boolean {
        return this.dialogRefStack.length > 0;
    }
}
