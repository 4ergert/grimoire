import { Component } from '@angular/core';

@Component({
  selector: 'button[custom-button]',
  template: '<span class="custom_button"><ng-content></ng-content></span>',
  imports: [],
  // templateUrl: './button.html',
  styleUrls: ['./button.scss'],
})
export class CustomButton {}
