import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { Legal } from './legal';

describe('Legal pages', () => {
  it('should allow public navigation between both drafts and link back to login', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/impressum', Legal);

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Legal notice');
    expect(harness.routeNativeElement?.textContent).toContain('unreviewed draft');
    expect(document.title).toBe('Legal notice | Grimoire');
    expect(harness.routeNativeElement?.querySelector('.draft')).toBeNull();
    expect(harness.routeNativeElement?.querySelector('a[href="/"]')).not.toBeNull();
    expect(
      harness.routeNativeElement?.querySelectorAll('app-legal-footer a'),
    ).toHaveLength(3);

    await harness.navigateByUrl('/datenschutz', Legal);

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(
      'Privacy policy',
    );
    expect(harness.routeNativeElement?.textContent).toContain('ALL-INKL');
    expect(harness.routeNativeElement?.textContent).toContain('full IP addresses');
    expect(harness.routeNativeElement?.textContent).toContain('no later than seven days');
    expect(harness.routeNativeElement?.textContent).toContain('Article 6(1)(f) GDPR');
    expect(harness.routeNativeElement?.textContent).toContain('Firebase');
    expect(harness.routeNativeElement?.textContent).toContain('Cloud Data Processing Addendum');
    expect(harness.routeNativeElement?.textContent).toContain('contracting entity');
    expect(harness.routeNativeElement?.textContent).toContain('Standard Contractual Clauses');
    expect(
      harness.routeNativeElement?.querySelector(
        'a[href="https://firebase.google.com/terms/subprocessors"]',
      ),
    ).not.toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('heartbeat information');
    expect(harness.routeNativeElement?.textContent).toContain('fixed general deletion period');
    expect(harness.routeNativeElement?.textContent).toContain('website data');
    expect(harness.routeNativeElement?.textContent).toContain('any required consent procedure');
    expect(document.title).toBe('Privacy policy | Grimoire');
    expect(harness.routeNativeElement?.textContent).toContain('automatic deletion due to inactivity');
    expect(harness.routeNativeElement?.textContent).toContain(
      'Signing out alone does not delete the account.',
    );
    expect(harness.routeNativeElement?.querySelector('a[href^="mailto:"]')).not.toBeNull();
    expect(
      harness.routeNativeElement?.querySelector('a[href="https://www.ldi.nrw.de/kontakt"]'),
    ).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('.draft')).toBeNull();

    await harness.navigateByUrl('/nutzungsbedingungen', Legal);
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Terms of Use');
    expect(harness.routeNativeElement?.textContent).toContain('currently offered free of charge');
    expect(harness.routeNativeElement?.textContent).toContain('guest mode without an account');
    expect(harness.routeNativeElement?.textContent).toContain('Mandatory consumer protection rights');
  });
});
