import { Component } from '@angular/core';

@Component({
  selector: 'button[custom-button]',
  templateUrl: './button.html',
  styleUrls: ['./button.scss'],
})
/** Styled button; apply it to a native element as `<button custom-button>`. */
export class CustomButton {}
