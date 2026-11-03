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

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Impressum');
    expect(harness.routeNativeElement?.querySelector('.draft')).toBeNull();
    expect(harness.routeNativeElement?.querySelector('a[href="/"]')).not.toBeNull();

    await harness.navigateByUrl('/datenschutz', Legal);

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(
      'Datenschutzerklärung',
    );
    expect(harness.routeNativeElement?.textContent).toContain('ALL-INKL');
    expect(harness.routeNativeElement?.textContent).toContain('Firebase');
    expect(harness.routeNativeElement?.textContent).toContain('Eine automatische Löschung');
    expect(harness.routeNativeElement?.textContent).toContain(
      'Abmelden allein löscht das Konto nicht.',
    );
    expect(harness.routeNativeElement?.querySelector('a[href^="mailto:"]')).not.toBeNull();
    expect(
      harness.routeNativeElement?.querySelector('a[href="https://www.ldi.nrw.de/kontakt"]'),
    ).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('.draft')).toBeNull();
  });
});
