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
import { I18nTranslation } from '@zeta/i18n';


export const authTranslations_deDE: I18nTranslation[] = [
    // AuthLoginComponent
    // html
    {
        key: 'zeta.auth-login.login-title',
        value: 'Anmelden'
    },
    {
        key: 'zeta.auth-login.subtitle1',
        value: 'Mit Chipkarte anmelden'
    },
    {
        key: 'zeta.auth-login.subtitle2',
        value: 'Benutzeranmeldung'
    },
    {
        key: 'zeta.auth-login.subtitle3',
        value: 'Workflow-Anmeldung'
    },
    {
        key: 'zeta.auth-login.login-button',
        value: 'Anmelden'
    },
    {
        key: 'privacy-button',
        value: 'Datenschutz'
    },

    // typescript
    {
        key: 'zeta.auth-login.error',
        value: 'Fehler'
    },
    {
        key: 'zeta.auth-login.authentication-failed',
        value: 'Authentifizierung fehlgeschlagen!'
    },
    {
        key: 'zeta.auth-login.error-header',
        value: 'Achtung'
    },
    {
        key: 'zeta.auth-login.error-message',
        value: 'Es gibt bereits eine Sitzung für den Benutzer $0. Trotzdem anmelden und die Sitzung beenden?'
    },
    {
        key: 'zeta.auth-login.duplicate-session-header',
        value: 'Doppelte Sitzung'
    },
    {
        key: 'zeta.auth-login.duplicate-session-message',
        value: 'Der Benutzer $username ist bereits angemeldet. Sitzung schließen und eine neue starten?'
    },

    // CredentialsLoginTabComponent
    // html
    {
        key: 'zeta.auth-login.username-input',
        value: 'Benutzername'
    },
    {
        key: 'zeta.auth-login.clear-tooltip',
        value: 'Leeren'
    },
    {
        key: 'zeta.auth-login.password-input',
        value: 'Kennwort'
    },
    {
        key: 'zeta.auth-login.show-password-tooltip',
        value: 'Kennwort anzeigen'
    },

    // SmartCardLoginComponent
    // html
    {
        key: 'zeta.auth-login.user-input',
        value: 'Benutzer'
    },
    {
        key: 'zeta.auth-login.role-input',
        value: 'Rolle'
    },

    // change-password-dialog
    { key: 'dialog.changePassword.title', value: 'Kennwort ändern' },
    { key: 'dialog.changePassword.oldPassword', value: 'Altes Kennwort' },
    { key: 'dialog.changePassword.newPassword', value: 'Neues Kennwort' },
    { key: 'dialog.changePassword.newPassword.error', value: 'Kennwort erfüllt nicht die Anforderungen' },
    { key: 'dialog.changePassword.confirmPassword', value: 'Neues Kennwort bestätigen' },
    { key: 'dialog.changePassword.confirmPassword.error', value: 'Passwörter stimmen nicht überein' },
    { key: 'dialog.changePassword.hint', value: 'Das neue Kennwort muss folgende Regel erfüllen: $0' },
    { key: 'dialog.changePassword.error.unauthorized', value: 'Das alte Kennwort ist nicht korrekt.' },
    { key: 'dialog.changePassword.cancel', value: 'Abbrechen' },
    { key: 'dialog.changePassword.apply', value: 'Anwenden' }
];
