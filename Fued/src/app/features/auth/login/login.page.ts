import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonInputPasswordToggle,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonRouterLink,
  IonSpinner,
} from '@ionic/angular';
import { TPipe } from '../../../core/i18n/i18n.pipes';
import { LoginViewModel } from './login.viewmodel';

@Component({
  selector: 'app-login',
  templateUrl: 'login.page.html',
  styleUrls: ['login.page.scss'],
  providers: [LoginViewModel],
  imports: [
    RouterLink,
    IonRouterLink,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonInput,
    IonInputPasswordToggle,
    IonButton,
    IonSpinner,
    IonIcon,
    IonLabel,
    TPipe,
  ],
})
export class LoginPage {
  readonly vm = inject(LoginViewModel);
}
