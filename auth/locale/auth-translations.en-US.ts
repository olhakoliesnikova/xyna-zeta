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


export const authTranslations_enUS: I18nTranslation[] = [
    // AuthLoginComponent
    // html
    {
        key: 'zeta.auth-login.login-title',
        value: 'Login'
    },
    {
        key: 'zeta.auth-login.subtitle1',
        value: 'Authenticate with SmartCard'
    },
    {
        key: 'zeta.auth-login.subtitle2',
        value: 'Authenticate with credentials'
    },
    {
        key: 'zeta.auth-login.subtitle3',
        value: 'Authenticate via Workflow'
    },
    {
        key: 'zeta.auth-login.login-button',
        value: 'Login'
    },
    {
        key: 'privacy-button',
        value: 'Privacy Policy'
    },
    // typescript
    {
        key: 'zeta.auth-login.error',
        value: 'Error'
    },
    {
        key: 'zeta.auth-login.authentication-failed',
        value: 'Authentication failed!'
    },
    {
        key: 'zeta.auth-login.error-header',
        value: 'Attention'
    },
    {
        key: 'zeta.auth-login.error-message',
        value: 'There already exists a session for the user $0. Login anyway and quit that session?'
    },
    {
        key: 'zeta.auth-login.duplicate-session-header',
        value: 'Duplicate Session'
    },
    {
        key: 'zeta.auth-login.duplicate-session-message',
        value: 'User $username is already logged in. Do you want to close the old session and start a new one?'
    },

    // CredentialsLoginTabComponent
    // html
    {
        key: 'zeta.auth-login.username-input',
        value: 'Username'
    },
    {
        key: 'zeta.auth-login.clear-tooltip',
        value: 'Clear'
    },
    {
        key: 'zeta.auth-login.password-input',
        value: 'Password'
    },
    {
        key: 'zeta.auth-login.show-password-tooltip',
        value: 'Show Password'
    },

    // SmartCardLoginComponent
    // html
    {
        key: 'zeta.auth-login.user-input',
        value: 'User'
    },
    {
        key: 'zeta.auth-login.role-input',
        value: 'Role'
    },

    // change-password-dialog
    { key: 'dialog.changePassword.title', value: 'Change Password' },
    { key: 'dialog.changePassword.oldPassword', value: 'Old Password' },
    { key: 'dialog.changePassword.newPassword', value: 'New Password' },
    { key: 'dialog.changePassword.newPassword.error', value: 'Password does not meet the requirements' },
    { key: 'dialog.changePassword.confirmPassword', value: 'Confirm Password' },
    { key: 'dialog.changePassword.confirmPassword.error', value: 'Passwords do not match' },
    { key: 'dialog.changePassword.hint', value: 'The new password must match the following rule: $0' },
    { key: 'dialog.changePassword.error.unauthorized', value: 'The old password is incorrect.' },
    { key: 'dialog.changePassword.cancel', value: 'Cancel' },
    { key: 'dialog.changePassword.apply', value: 'Apply' }
];
