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
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';

import { ApiInterceptor } from './api.interceptor';
import { RightsInterceptor } from './rights.interceptor';
import { inject, provideAppInitializer } from '@angular/core';
import { ConfigService } from './config.service';


export const ApiRoutes: Routes = [
];


export const ApiRoutingModules = [
    RouterModule.forChild(ApiRoutes)
];


export const ApiRoutingProviders = [
    { provide: HTTP_INTERCEPTORS, useClass: ApiInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: RightsInterceptor, multi: true },
     provideAppInitializer(() => {
      const configService: ConfigService = inject(ConfigService);
      return configService.initialize();
    })
];
