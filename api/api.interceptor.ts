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
import { HttpContextToken, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ConfigService } from '@zeta/api/config.service';
import { Observable } from 'rxjs';


export const SKIP_API_INTERCEPTOR = new HttpContextToken<boolean>(() => false);

@Injectable()
export class ApiInterceptor implements HttpInterceptor {
    private readonly configService = inject(ConfigService);

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        if (req.responseType !== 'text' && !req.context.get(SKIP_API_INTERCEPTOR)) {
            req = req.clone({ url: this.configService.config.zeta.url + req.url });
        }
        return next.handle(req);
    }
}
