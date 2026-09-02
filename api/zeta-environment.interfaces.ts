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
import { RuntimeContext } from './xo/xo-describer';


export interface XynaOptions {
    /**
     * runtime context where xyna datatypes are defined. Needed for consistency check
     */
    runtimeContext: RuntimeContext;
    /**
     * flag, which determines if the GUI checks its xo-datatypes against the xyna datatypes
     */
    consistencyCheck: boolean;
}


export interface CredentialsWorkflowOptions {
    /**
     * flag, which determines whether the user is able to login via workflow
     */
    credentialsWorkflowLogin: boolean;
    /**
    * Domain through which the user logs in via workflow
    */
    credentialsWorkflowDomain: string;
}


export interface SelectableLanguage {
    /**
     * string, whose translation will be displayed in the language dropdown
     */
    label: string;
    /**
     * language key to uniquely identify this language (e.g. "en-US" or "de-DE")
     */
    languageKey: string;
    /**
     * the base url of the respective index.html (or undefined, if there is no different website for this language due to dynamic i18n)
     */
    baseUrl?: string;
}


export interface AuthenticationOptions {
    /**
     * flag, which determines whether the user is able to login via username/password
     */
    credentialsLogin: boolean;
    /**
     * flag, which determines whether the user is able to login via smart card
     */
    smartCardLogin: boolean;
    /**
     * options, which determines whether the user is able to login via workflow
     */
    credentialsWorkflowOptions?: CredentialsWorkflowOptions;
    /**
     * Array of languages, which can be selected by the user - dropdown will not be rendered if falsey
     */
    languages?: SelectableLanguage[];
    /**
     * Token prepended to the request's URL (`https://{ip}:{port}{token}/...`)
     * Purpose:
     * 1. Helps the web server to identify which requests belong to which application
     * 2. Authentication Cookies set this token as their path such that they're only appended to requests matching that token
     *
     * To run with Tomcat (and the `XynaBlackEditionWebService`), this token has to be unset or `/XynaBlackEditionWebServices/io`
     */
    pathToken?: string;
    /**
     * flag, which determines whether the user is always logged in with force=true
     */
    useTheForcedLogin?: boolean;
}


export interface ZetaProjectOptions {
    /**
     * URL of the Xyna Black Edition Web Services - io
     */
    url: string;
    /**
     * holds options how the GUI interacts with Xyna Black Edition
     */
    xo: XynaOptions;
    /**
     * holds options about how the user is able to login to the GUI - default: only credentials login and no language change
     */
    auth?: AuthenticationOptions;
    /**
     * returns the URL to the privacy website depending on a language parameter. If defined, the auth-login mask shows a corresponding button
     */
    getPrivacyLink?(lang: string): string;
}

export interface ZetaEnvironment {
    /**
     * flag, which determines whether angular builds the project for production use or development use
     */
    production: boolean;
    /**
     * holds options important for the Zeta Framework
     * @deprecated
     * Please use config.service instead. config.service loads config.json in asset folder. config.json has a similar structure and can be modified after build.
     * If config.json is not found, this will be used as default. This behavior will be removed in future versions.
     */
    zeta?: ZetaProjectOptions;
    /**
     * this allows projects to add specific properties to their environment constant
     */
    [propName: string]: any;
}
