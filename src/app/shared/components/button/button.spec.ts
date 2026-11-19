import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';

import { CustomButton } from './button';

@Component({
  imports: [CustomButton],
  template: `<button custom-button type="button">Click me</button>`,
})
class Host {}

describe('CustomButton', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  it('should project its label into the button', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');

    expect(button.querySelector('.custom_button')?.textContent?.trim()).toBe('Click me');
  });
});
