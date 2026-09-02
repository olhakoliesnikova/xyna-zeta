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
import { inject, Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { Observable, of } from 'rxjs';
import { catchError, filter, map, mapTo, switchMap, tap } from 'rxjs/operators';

import { A11yService } from '../a11y';
import { ApiService, RuntimeContext, XoConsistencyCheck, XoObject } from '../api';
import { AuthEventService } from './auth-event.service';
import { SessionInfo } from './auth-session';
import { XoExternalCredentialsLoginRequest } from './xo/external-credentials-login-request.model';
import { XoExternalUserLoginRequest } from './xo/external-user-login-request.model';
import { XoLoginRequest } from './xo/login-request.model';
import { XoLogoutRequest } from './xo/logout-request.model';
import { XoSharedLoginRequest } from './xo/shared-login-request.model';
import { ConfigService } from '@zeta/api/config.service';


export interface SmartCardInfo {
    username: string;
    externaldomains: string[]; // TODO: rename to "externalDomains"
    userdisplayname: string;   // TODO: rename to "userDisplayname"
    domains?: SmartCardDomainInfo[];
}


export interface SmartCardDomainInfo {
    name: string;
    roles: string[];
}


interface SmartCardInfoResponse {
    username?: string;
    externaldomains?: string[];
    userdisplayname?: string;
    domains?: SmartCardDomainInfo[];
}


class StartOrderRight {

    private constructor(
        private readonly rtc: RuntimeContext,
        private readonly orderTypeRegExp?: RegExp,
        private readonly orderTypeOptions?: string[],
        private readonly orderTypeString?: string) {
    }


    matches(orderType: string, rtc?: RuntimeContext): boolean {
        if (rtc && !rtc.equals(this.rtc)) {
            return false;
        }
        if (this.orderTypeRegExp) {
            return this.orderTypeRegExp.test(orderType);
        }
        if (this.orderTypeOptions) {
            return !!this.orderTypeOptions.find(option => option === orderType);
        }
        if (this.orderTypeString) {
            return orderType.startsWith(this.orderTypeString);
        }
        return false;
    }


    static fromRegExp(regExp: RegExp, rtc: RuntimeContext): StartOrderRight {
        return new StartOrderRight(rtc, regExp, undefined, undefined);
    }


    static fromOptions(options: string[], rtc: RuntimeContext): StartOrderRight {
        return new StartOrderRight(rtc, undefined, options, undefined);
    }


    static fromString(string: string, rtc: RuntimeContext): StartOrderRight {
        return new StartOrderRight(rtc, undefined, undefined, string);
    }
}


@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly authEventService = inject(AuthEventService);
    private readonly http = inject(HttpClient);
    private readonly router = inject(Router);
    private readonly configService = inject(ConfigService);


    static readonly urlFragment = 'Authenticate';
    private startOrderRightFallback: boolean;
    private startOrderRights: StartOrderRight[];
    private readonly dynamicRights = new Set<string>();

    private readonly rightMatcher = /^[^:]*/;   // match up to the first ':'

    postAuthenticationHook = (sessionInfo: SessionInfo) => of(undefined);


    constructor() {
        const route = inject(ActivatedRoute);
        const apiService = inject(ApiService);
        const a11y = inject(A11yService);

        // refreshes sessionInfo every time when tab is set to active
        a11y.visibilityChange.pipe(
            filter(visible => visible),
            tap(() => this.fetchSessionInfo().subscribe())
        ).subscribe();

        // subscribe to session changes
        this.sessionInfoChange.pipe(
            filter(sessionInfo => !!sessionInfo)
        ).subscribe(sessionInfo => {

            // run consistency check
            XoConsistencyCheck.run(apiService, this.configService.config.zeta.xo);

            // update server time offset
            sessionInfo.serverTimeOffset = sessionInfo.serverTime - +new Date();

            // update start order rights
            this.startOrderRightFallback = !!this.rights.find(rightString => rightString === 'START_ORDER');
            this.startOrderRights = this.rights
                .filter(rightString =>
                    rightString.startsWith('xprc.xpce.StartOrder')
                )
                .map(rightString => {
                    const params = rightString.split(':');
                    if (params.length < 4) {
                        return undefined;
                    }
                    const rtc = params[3]
                        ? RuntimeContext.fromApplicationVersion(params[2], params[3])
                        : RuntimeContext.fromWorkspace(params[2]);
                    const orderType = params[1];
                    // :/<RegExp>/:
                    // order type must match regular expression
                    if (orderType.startsWith('/') && orderType.endsWith('/')) {
                        return StartOrderRight.fromRegExp(new RegExp(orderType.substring(1, orderType.length - 2)), rtc);
                    }
                    // :[xact.device.get, xact.device.delete, xact.device.create]:
                    // order type must be one of "xact.device.get", "xact.device.delete" or "xact.device.create"
                    if (orderType.startsWith('[') && orderType.endsWith(']')) {
                        return StartOrderRight.fromOptions(orderType.substring(1, orderType.length - 2).split(',').map(option => option.trim()), rtc);
                    }
                    // :xact.device.*:
                    // order type must start with the string up to the asterisk "xact.device."
                    if (orderType.endsWith('*')) {
                        return StartOrderRight.fromString(orderType.substring(0, orderType.length - 1), rtc);
                    }
                    return undefined;
                })
                .filter(right => !!right);

            // handle authentication changes
            if (!this.authenticated) {
                // logout occured, so require re-authentication with no redirect url
                this.requireAuthentication();
            } else if (this.isRoutedToUrlFragment()) {
                // perform redirect as specified in route query params and call post authentication hook
                this.postAuthenticationHook(sessionInfo).subscribe(() => {
                    const redirectUrl = route.snapshot.queryParams.redirect || '';
                    // allow dynamic route setup by first routing to base url
                    void this.router.navigateByUrl('/').then(
                        // afterwards, we can route to the requested redirect url
                        () => this.router.navigateByUrl(redirectUrl)
                    );
                });
            }
        });
    }


    private isRoutedToUrlFragment(): boolean {
        return this.router.url.split('?')[0].substr(1) === AuthService.urlFragment;
    }


    queryAuthentication(redirectUrl?: string): Observable<boolean> {
        if (!this.authenticated) {
            return this.fetchSessionInfo().pipe(
                switchMap(sessionInfo => this.postAuthenticationHook(sessionInfo).pipe(mapTo(true))),
                catchError(() => {
                    this.requireAuthentication(redirectUrl);
                    return of(false);
                })
            );
        }
        return of(true);
    }


    requireAuthentication(redirectUrl?: string) {
        // notify observers of session loss
        if (this.authenticated) {
            this.authEventService.sessionInfoSubject.next(undefined);
            this.authEventService.logoutSubject.next(undefined);
        }
        // route to url fragment, if we aren't there already
        if (!this.isRoutedToUrlFragment()) {
            void this.router.navigate(
                [AuthService.urlFragment],
                redirectUrl
                    ? { queryParams: { redirect: redirectUrl } }
                    : undefined
            );
        }
    }


    private customLogin(url: string, payload: XoObject): Observable<SessionInfo> {
        return this.http.post<SessionInfo>(url, payload.encode()).pipe(
            switchMap(sessionInfo => this.postAuthenticationHook(sessionInfo).pipe(mapTo(sessionInfo))),
            tap(sessionInfo => {
                this.authEventService.sessionInfoSubject.next(sessionInfo);
                this.authEventService.loginSubject.next(sessionInfo);
            })
        );
    }


    fetchSessionInfo(): Observable<SessionInfo> {
        return this.http.get<SessionInfo>('auth/info').pipe(
            tap(sessionInfo => this.authEventService.sessionInfoSubject.next(sessionInfo))
        );
    }


    fetchSmartCardInfo(): Observable<SmartCardInfo> {
        // TODO: url should be 'auth/externalinfo'
        return this.http.get<SmartCardInfoResponse>('auth/externalUserLoginInformation').pipe(
            map(info => this.normalizeSmartCardInfo(info))
        );
    }


    private get pathToken(): string {
        return this.configService.config.zeta.auth ? this.configService.config.zeta.auth.pathToken : '/';
    }


    /**
     * normalizes backend smart card info into a clean, UI-friendly model with robust data.
     */
    private normalizeSmartCardInfo(info: SmartCardInfoResponse): SmartCardInfo {
        const domains = (info.domains ?? [])
            .filter(domain => !!domain?.name)
            .map(domain => ({
                name: domain.name,
                roles: (domain.roles ?? []).filter(role => !!role)
            }));
        const externaldomains = (info.externaldomains ?? [])
            .filter(domain => !!domain);

        return {
            username: info.username ?? '',
            userdisplayname: info.userdisplayname ?? '',
            externaldomains,
            domains
        };
    }


    /**
     * Performs a login via xyna user credentials
     * @param username Username
     * @param password Password
     */
    login(username: string, password: string, force = false): Observable<SessionInfo> {
        return this.customLogin('auth/login', XoLoginRequest.withCredentials(username, password, this.pathToken, force));
    }


    workflowLogin(username: string, password: string, domain: string, force = false): Observable<SessionInfo> {
        return this.customLogin('auth/externalCredentialsLogin', XoExternalCredentialsLoginRequest.withDomain(username, password, domain, this.pathToken, force));
    }


    /**
     * Performs a login via an external smart card
     * @param domain Domain
     * @param force Enforce login
     */
    smartCardLogin(domain: string, force = false, selectedRole?: string): Observable<SessionInfo> {
        // TODO: url should be 'auth/externallogin'
        return this.customLogin('auth/externalUserLogin', XoExternalUserLoginRequest.withDomain(domain, this.pathToken, force, selectedRole));
    }


    /**
     * Performs a login without generating a new session id and token
     * @param sessionId Valid session id
     * @param token Valid token
     */
    sharedLogin(sessionId: string, token: string): Observable<SessionInfo> {
        return this.customLogin('auth/sharedlogin', XoSharedLoginRequest.withCredentials(sessionId, token, this.pathToken));
    }


    /**
     * Performs a server logout and clears the info about the current session
     */
    logout(): Observable<void> {
        return this.http.post<void>('auth/logout', XoLogoutRequest.logout(this.pathToken).encode()).pipe(
            tap(() => {
                this.authEventService.sessionInfoSubject.next(undefined);
                this.authEventService.logoutSubject.next(undefined);
            })
        );
    }


    /**
     * Performs a request to change the user's password
     */
    changePassword(oldPassword: string, newPassword: string): Observable<void> {
        return this.http.post<void>('auth/changepassword', { oldPassword, newPassword });
    }


    get sessionInfo(): SessionInfo {
        return this.authEventService.sessionInfoSubject.value;
    }


    get sessionInfoChange(): Observable<SessionInfo> {
        return this.authEventService.sessionInfoSubject.asObservable();
    }


    get didLogin(): Observable<SessionInfo> {
        return this.authEventService.loginSubject.asObservable();
    }


    get didLogout(): Observable<SessionInfo> {
        return this.authEventService.logoutSubject.asObservable();
    }


    get authenticated(): boolean {
        return !!this.sessionInfo;
    }


    get role(): string {
        return this.sessionInfo?.role ?? '';
    }


    get username(): string {
        return this.sessionInfo?.username ?? '';
    }


    get rights(): string[] {
        return this.sessionInfo?.rights ?? [];
    }


    get serverTimeOffset(): number {
        return this.sessionInfo?.serverTimeOffset ?? 0;
    }


    hasStartOrderRight(orderType: string, rtc?: RuntimeContext): boolean {
        return (this.startOrderRights.length === 0 && this.startOrderRightFallback) ||
            !!this.startOrderRights.find(right => right.matches(orderType, rtc));
    }


    hasRight(right: string): boolean {
        return !!this.rights.find(r => this.rightMatcher.exec(r)[0] === right) || this.hasDynamicRight(right);
    }


    hasDynamicRight(right: string): boolean {
        return this.dynamicRights.has(right);
    }


    addDynamicRight(right: string) {
        this.dynamicRights.add(right);
    }


    deleteDynamicRight(right: string): boolean {
        return this.dynamicRights.delete(right);
    }


    clearDynamicRights() {
        this.dynamicRights.clear();
    }
}
