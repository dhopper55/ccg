import { JSX, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { FormProvider, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Box, Button, Stack, Step, StepLabel, Stepper, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import * as yup from 'yup';
import CompanyInfoForm, {
  CompanyInfo,
  companyInfoSchema,
} from 'components/sections/crm/add-contact/steps/CompanyInfoForm';
import ConfirmationForm, {
  ConfirmationBubble,
} from 'components/sections/crm/add-contact/steps/ConfirmationForm';
import LeadInfoForm, {
  LeadInfo,
  leadInfoSchema,
} from 'components/sections/crm/add-contact/steps/LeadInfoForm';
import PersonalInfoForm, {
  PersonalInfo,
  personalInfoSchema,
} from 'components/sections/crm/add-contact/steps/PersonalInfoForm';

interface AddContactStepperStep {
  id: number;
  label: JSX.Element;
  content: JSX.Element | null;
}

// Step indices (0-based)
const PAYMENT_STEP_INDEX = 2;
const PHOTOS_STEP_INDEX = 3;
const SUCCESS_STEP = 4; // past end of steps array — shows success screen

const steps: AddContactStepperStep[] = [
  {
    id: 1,
    label: <Typography variant="subtitle2" fontWeight={700}>Guitar Info</Typography>,
    content: <PersonalInfoForm />,
  },
  {
    id: 2,
    label: <Typography variant="subtitle2" fontWeight={700}>Contact Info</Typography>,
    content: <LeadInfoForm label="Contact Info" />,
  },
  {
    id: 3,
    label: <Typography variant="subtitle2" fontWeight={700}>Payment</Typography>,
    content: null, // ConfirmationForm rendered directly by stepper
  },
  {
    id: 4,
    label: <Typography variant="subtitle2" fontWeight={700}>Photos</Typography>,
    content: <CompanyInfoForm label="Photos" />,
  },
];

const validationSchemas: (yup.ObjectSchema<any> | null)[] = [
  personalInfoSchema,
  leadInfoSchema,
  null, // payment step — form validates internally
  companyInfoSchema,
];

export interface ContactForm extends CompanyInfo, PersonalInfo, LeadInfo {}

interface AddContactStepperProps {
  onFirstAdvance?: () => void;
}

const AddContactStepper = ({ onFirstAdvance }: AddContactStepperProps) => {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [evaluationId, setEvaluationId] = useState<number | null>(null);

  // If returning from a Stripe redirect (e.g. Cash App Pay), jump to the payment step
  // so ConfirmationForm can resolve the redirect_status and advance to Photos.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('redirect_status')) {
      setActiveStep(PAYMENT_STEP_INDEX);
    }
  }, []);

  const { enqueueSnackbar } = useSnackbar();
  const [searchParams] = useSearchParams();

  const currentSchema = activeStep < validationSchemas.length ? validationSchemas[activeStep] : null;
  const methods = useForm<ContactForm>({
    resolver: currentSchema ? yupResolver(currentSchema as yup.ObjectSchema<ContactForm>) : undefined,
    defaultValues: {
      personalInfo: {
        includesCase: 'no',
        serialNumber: searchParams.get('serial') ?? undefined,
        brand: searchParams.get('brand') ?? '',
      } as PersonalInfo['personalInfo'],
      companyInfo: { photos: [] },
      leadInfo: { firstName: '', lastName: '', email: '' },
    },
  });

  const { handleSubmit } = methods;

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const persistGuitarInfo = async (data: ContactForm) => {
    const resolvedBrand =
      data.personalInfo?.brand === 'Other'
        ? (data.personalInfo?.brandOther ?? 'Other')
        : data.personalInfo?.brand;

    const decodeIdParam = searchParams.get('decodeId');
    const guitarPayload = {
      serialNumber: data.personalInfo?.serialNumber || null,
      brand: resolvedBrand,
      brandOther: data.personalInfo?.brandOther || null,
      model: data.personalInfo?.model || null,
      includesCase: data.personalInfo?.includesCase,
      colorFinish: data.personalInfo?.colorFinish || null,
      location: data.personalInfo?.location || null,
      note: data.personalInfo?.note,
      damage: data.personalInfo?.damage,
      serialDecodeId: decodeIdParam ? Number(decodeIdParam) : null,
    };

    if (evaluationId) {
      const res = await fetch(`/api/guitar-evaluation/${evaluationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(guitarPayload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || 'Update failed. Please try again.');
      }
    } else {
      const res = await fetch('/api/guitar-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...guitarPayload, firstName: '', lastName: '', email: '' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || 'Submission failed. Please try again.');
      }
      const result = (await res.json()) as { id: number };
      setEvaluationId(result.id);
    }
  };

  const persistContactInfo = async (data: ContactForm) => {
    if (!evaluationId) throw new Error('Evaluation record not found. Please restart.');

    const res = await fetch(`/api/guitar-evaluation/${evaluationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: data.leadInfo?.firstName,
        lastName: data.leadInfo?.lastName,
        email: data.leadInfo?.email,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).message || 'Contact info save failed. Please try again.');
    }
  };

  const persistPhotos = async () => {
    if (!evaluationId) throw new Error('Evaluation record not found. Please go back and try again.');

    const companyInfo = methods.getValues('companyInfo');
    const photoFiles: File[] = [];
    const mainPhoto = companyInfo?.mainPhoto;
    if (mainPhoto instanceof File) photoFiles.push(mainPhoto);
    for (const p of companyInfo?.photos ?? []) {
      if (p instanceof File) photoFiles.push(p);
    }

    if (photoFiles.length === 0) return;

    const fd = new FormData();
    for (const file of photoFiles) fd.append('photos', file);
    const uploadRes = await fetch(`/api/guitar-evaluation/${evaluationId}/upload-images`, {
      method: 'POST',
      body: fd,
    });
    if (!uploadRes.ok) {
      const uploadBody = await uploadRes.json().catch(() => ({}));
      throw new Error(`Photo upload failed: ${(uploadBody as any)?.message ?? 'unknown error'}`);
    }
  };

  const handleStepSubmit = async (data: ContactForm) => {
    setSubmitting(true);
    try {
      if (activeStep === 0) {
        await persistGuitarInfo(data);
      } else if (activeStep === 1) {
        await persistContactInfo(data);
      } else if (activeStep === PHOTOS_STEP_INDEX) {
        await persistPhotos();
      }
      setCompletedSteps((prev) => ({ ...prev, [activeStep]: true }));
      setActiveStep((prev) => {
        if (prev === 0) onFirstAdvance?.();
        return prev + 1;
      });
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (e: any) {
      enqueueSnackbar(e?.message ?? 'Something went wrong. Please try again.', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeStep === PAYMENT_STEP_INDEX) return; // payment form handles its own submit
    if (activeStep === SUCCESS_STEP) return;
    handleSubmit(handleStepSubmit)();
  };

  const isPaymentStep = activeStep === PAYMENT_STEP_INDEX;
  const isSuccessStep = activeStep === SUCCESS_STEP;

  const handlePaymentPaid = () => {
    setCompletedSteps((prev) => ({ ...prev, [PAYMENT_STEP_INDEX]: true }));
    setActiveStep(PHOTOS_STEP_INDEX);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  return (
    <FormProvider {...methods}>
      <Box sx={{ width: '80%', mx: 'auto' }}>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
          {steps.map(({ id, label }, index) => (
            <Step key={id} completed={!!completedSteps[index]} sx={{ p: 0 }}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box component="form" onSubmit={handleFormSubmit}>
          <Box sx={{ mb: 7 }}>
            {isSuccessStep ? (
              <ConfirmationBubble />
            ) : isPaymentStep ? (
              <ConfirmationForm evaluationId={evaluationId} onPaid={handlePaymentPaid} />
            ) : (
              steps[activeStep]?.content
            )}
          </Box>

          <Stack gap={2} justifyContent="flex-end">
            {activeStep > 0 && !isPaymentStep && !isSuccessStep && (
              <Button variant="soft" color="neutral" onClick={handleBack} sx={{ px: 4 }} disabled={submitting}>
                Back
              </Button>
            )}

            {!isPaymentStep && !isSuccessStep && (
              <Button type="submit" variant="soft" loading={submitting}>
                Save & Continue
              </Button>
            )}
          </Stack>
        </Box>
      </Box>
    </FormProvider>
  );
};

export default AddContactStepper;
