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

import { Component, Input, inject } from '@angular/core';

import { SelectableLanguage } from '../../api';
import { Comparable } from '../../base';
import { I18nService } from '../../i18n/i18n.service';
import { XcAutocompleteDataWrapper, XcFormAutocompleteComponent } from '../xc-form/xc-form-autocomplete/xc-form-autocomplete.component';
import { xcLanguageSelectorTranslations_deDE } from './locale/xc-language-selector-translations.de-DE';
import { xcLanguageSelectorTranslations_enUS } from './locale/xc-language-selector-translations.en-US';
import { LocaleService, XcI18nTranslateDirective } from '../../i18n';
import { ConfigService } from '@zeta/api/config.service';


class ComparableLanguage extends Comparable implements SelectableLanguage {

    label: string;
    languageKey: string;
    baseUrl: string;

    constructor(lang: SelectableLanguage) {
        super();
        this.label = lang.label;
        this.languageKey = lang.languageKey;
        this.baseUrl = lang.baseUrl;
    }

    equals(other?: this) {
        return this.languageKey === other.languageKey;
    }
}


@Component({
    selector: 'xc-language-selector',
    templateUrl: './xc-language-selector.component.html',
    styleUrls: ['./xc-language-selector.component.scss'],
    imports: [XcFormAutocompleteComponent, XcI18nTranslateDirective]
})
export class XcLanguageSelectorComponent {
    private readonly i18n = inject(I18nService);
    readonly locale = inject(LocaleService);
    readonly configService = inject(ConfigService);

    @Input() tabIndex?: number = 0;

    selectLanguageDataWrapper: XcAutocompleteDataWrapper;
    hasLanguages: boolean;
    selectedLanguage: ComparableLanguage;

    constructor() {
        const locale = this.locale;

        this.i18n.setTranslations(LocaleService.DE_DE, xcLanguageSelectorTranslations_deDE);
        this.i18n.setTranslations(LocaleService.EN_US, xcLanguageSelectorTranslations_enUS);

        const languages = this.configService.config.zeta.auth ? this.configService.config.zeta.auth.languages : null;

        if ((this.hasLanguages = languages?.length > 0)) {
            const found = languages.find(lang => lang.languageKey === locale.language) || languages[0];
            this.selectedLanguage = new ComparableLanguage(found);
            this.selectLanguageDataWrapper = new XcAutocompleteDataWrapper(
                () => this.selectedLanguage,
                (lang: ComparableLanguage) => {
                    this.selectedLanguage = lang;
                    locale.language = this.selectedLanguage.languageKey;

                    // if baseUrl is set, switch to that URL
                    if (this.selectedLanguage.baseUrl) {
                        const url = window.location.origin + lang.baseUrl + 'Authenticate' + window.location.search;
                        window.location.href = url;
                    }
                }
            );
            const mapped = languages.map(value => {
                value.label = this.i18n.translate(value.label);
                return { name: value.label, value: new ComparableLanguage(value) };
            });
            this.selectLanguageDataWrapper.values = mapped;
        }
    }
}
