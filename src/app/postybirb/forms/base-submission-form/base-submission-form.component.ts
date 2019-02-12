import { Component, OnDestroy, Injector, ChangeDetectorRef, AfterViewInit, ViewChild } from '@angular/core';
import { ProfileStatuses, LoginManagerService } from 'src/app/login/services/login-manager.service';
import { Subscription, Subject, Observable } from 'rxjs';
import { Submission } from 'src/app/database/models/submission.model';
import { WebsiteRegistryEntry } from 'src/app/websites/registries/website.registry';
import { TypeOfSubmission } from 'src/app/utils/enums/type-of-submission.enum';
import { FormGroup, FormControl, FormBuilder, Validators } from '@angular/forms';
import { LoginStatus } from 'src/app/websites/interfaces/website-service.interface';
import { MatDialog } from '@angular/material';
import { ISubmission } from 'src/app/database/tables/submission.table';
import { DescriptionInput } from 'src/app/utils/components/description-input/description-input.component';
import { TagInput } from 'src/app/utils/components/tag-input/tag-input.component';
import { LoginProfileSelectDialog } from 'src/app/login/components/login-profile-select-dialog/login-profile-select-dialog.component';
import { debounceTime } from 'rxjs/operators';
import { LoginProfileManagerService } from 'src/app/login/services/login-profile-manager.service';

@Component({
  selector: 'base-submission-form',
  template: '<div></div>',
})
export class BaseSubmissionForm implements AfterViewInit, OnDestroy {
  @ViewChild('defaultTags') defaultTags: TagInput;
  @ViewChild('defaultDescription') defaultDescription: DescriptionInput;

  protected loginStatuses: ProfileStatuses = {};
  protected loginListener: Subscription = Subscription.EMPTY;

  public submission: Submission;
  public loading: boolean = false;
  public hideForReload: boolean = false;
  public triggerWebsiteReload: boolean = true;
  public availableWebsites: WebsiteRegistryEntry = {};

  public basicInfoForm: FormGroup;
  public formDataForm: FormGroup;
  public typeOfSubmission: TypeOfSubmission;
  public resetSubject: Subject<void> = new Subject();
  public onReset: Observable<void> = this.resetSubject.asObservable();

  protected _changeDetector: ChangeDetectorRef;
  protected dialog: MatDialog;
  protected _loginManager: LoginManagerService;
  protected _fb: FormBuilder;
  protected _loginProfileManager: LoginProfileManagerService;

  constructor(injector: Injector) {
    this._changeDetector = injector.get(ChangeDetectorRef);
    this.dialog = injector.get(MatDialog);
    this._loginManager = injector.get(LoginManagerService);
    this._fb = injector.get(FormBuilder);
    this._loginProfileManager = injector.get(LoginProfileManagerService);

    this.loginListener = this._loginManager.statusChanges.subscribe(statuses => {
      this.loginStatuses = statuses;
      this._changeDetector.markForCheck();
    });
  }

  ngAfterViewInit() {
    this.triggerWebsiteReload = false;
    this._changeDetector.markForCheck();
  }

  ngOnDestroy() {
    this.resetSubject.complete();
    this.loginListener.unsubscribe();
  }

  protected _initializeFormDataForm(): void {
    this.formDataForm = this._fb.group({
      loginProfile: [this._loginProfileManager.getDefaultProfile().id, Validators.required],
      defaults: this._fb.group({
        description: [null],
        tags: [null]
      })
    });

    this.formDataForm.addControl('websites', new FormControl([], { updateOn: 'blur', validators: [Validators.required] }));

    Object.keys(this.availableWebsites).forEach(website => {
      this.formDataForm.addControl(website, this._fb.group({
        // fields will be added by lower components
      }));
    });

    this.formDataForm.patchValue(this.submission.formData || {});
    if (!this.submission.formData) {
      this.submission.formData = this.formDataForm.value;
    }

    this.formDataForm.controls.loginProfile.valueChanges
      .subscribe(() => {
        this.triggerWebsiteReload = true;
        this._changeDetector.detectChanges();
        this.triggerWebsiteReload = false;
        this._changeDetector.detectChanges();
        this._changeDetector.markForCheck();
      });

    this.formDataForm.valueChanges
      .pipe(debounceTime(500))
      .subscribe(changes => {
        this.submission.formData = changes;
      });
  }

  public toggleLogin(): void {
    loginPanel.toggle();
  }

  public openProfileSelect(): void {
    this.dialog.open(LoginProfileSelectDialog)
      .afterClosed()
      .subscribe(profile => {
        if (profile) {
          this.formDataForm.controls.loginProfile.setValue(profile.id);
          this._changeDetector.markForCheck();
        }
      });
  }

  public isLoggedIn(website: string): boolean {
    try {
      if (this.loginStatuses && this.formDataForm && this.formDataForm.value.loginProfile) {
        if (this.loginStatuses[this.formDataForm.value.loginProfile][website]) {
          return this.loginStatuses[this.formDataForm.value.loginProfile][website].status === LoginStatus.LOGGED_IN;
        }
      }
    } catch (e) {
      // Catching because electron has a weird issue here
    }

    return false;
  }

  public getLoginProfileId(): string {
    return this.formDataForm.value.loginProfile;
  }

  protected _copySubmission(submission: ISubmission): void {
    if (submission.formData) this.formDataForm.patchValue(submission.formData || {});
    if (submission.rating) this.basicInfoForm.patchValue({ rating: submission.rating });
    this._changeDetector.markForCheck();
  }

}
