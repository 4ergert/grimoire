import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginOverlay } from './login-overlay';

describe('LoginOverlay', () => {
  let component: LoginOverlay;
  let fixture: ComponentFixture<LoginOverlay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginOverlay],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginOverlay);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
