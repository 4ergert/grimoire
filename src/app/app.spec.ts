import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';

@Component({ template: '<p>Page content</p>' })
class TestPage {}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([
        { path: '', component: TestPage },
        { path: 'impressum', component: TestPage },
        { path: 'datenschutz', component: TestPage },
      ])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('does not render a global legal footer', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    for (const route of ['/', '/impressum', '/datenschutz']) {
      await router.navigateByUrl(route);
      await fixture.whenStable();
      const compiled: HTMLElement = fixture.nativeElement;
      expect(compiled.querySelector('footer')).toBeNull();
    }
  });
});
