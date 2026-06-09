import { JSX, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { FormProvider, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Box, Button, Container, Stack, Step, StepLabel, Stepper, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import * as yup from 'yup';
import CompanyInfoForm, {
  CompanyInfo,
  companyInfoSchema,
} from 'components/sections/crm/add-contact/steps/CompanyInfoForm';
import ConfirmationForm from 'components/sections/crm/add-contact/steps/ConfirmationForm';
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
  content: JSX.Element;
  hasValidation: boolean;
}

const CONFIRMATION_STEP_INDEX = 3;

const steps: AddContactStepperStep[] = [
  {
    id: 1,
    label: (
      <Typography variant="subtitle2" fontWeight={700}>
        Guitar Info
      </Typography>
    ),
    content: <PersonalInfoForm />,
    hasValidation: true,
  },
  {
    id: 2,
    label: (
      <Typography variant="subtitle2" fontWeight={700}>
        Photos
      </Typography>
    ),
    content: <CompanyInfoForm label="Photos" />,
    hasValidation: true,
  },
  {
    id: 3,
    label: (
      <Typography variant="subtitle2" fontWeight={700}>
        Contact Info
      </Typography>
    ),
    content: <LeadInfoForm label="Contact Info" />,
    hasValidation: true,
  },
  {
    id: 4,
    label: (
      <Typography variant="subtitle2" fontWeight={700}>
        Finalize
      </Typography>
    ),
    content: null,
    hasValidation: false,
  },
];

const validationSchemas = [personalInfoSchema, companyInfoSchema, leadInfoSchema];

export interface ContactForm extends CompanyInfo, PersonalInfo, LeadInfo {}

interface AddContactStepperProps {
  onFirstAdvance?: () => void;
}

const AddContactStepper = ({ onFirstAdvance }: AddContactStepperProps) => {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [evaluationId, setEvaluationId] = useState<number | null>(null);

  // If returning from a Stripe redirect (e.g. Cash App Pay), jump straight to step 4.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('redirect_status')) {
      setActiveStep(CONFIRMATION_STEP_INDEX);
    }
  }, []);

  const { enqueueSnackbar } = useSnackbar();
  const [searchParams] = useSearchParams();
  const methods = useForm<ContactForm>({
    resolver: activeStep < validationSchemas.length
      ? yupResolver(validationSchemas[activeStep] as yup.ObjectSchema<ContactForm>)
      : undefined,
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
    setActiveStep((prevStep) => prevStep - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const handleStepSubmit = async (data: ContactForm) => {
    setSubmitting(true);
    try {
      if (activeStep === 0) {
        await persistGuitarInfo(data);
      } else if (activeStep === 1) {
        await persistPhotos();
      } else if (activeStep === 2) {
        await persistContactInfo(data);
      }
      setCompletedSteps((prev) => ({ ...prev, [activeStep]: true }));
      setActiveStep((prev) => {
        if (prev === 0) onFirstAdvance?.();
        return prev + 1;
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      enqueueSnackbar(e?.message ?? 'Something went wrong. Please try again.', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeStep === CONFIRMATION_STEP_INDEX) return;
    handleSubmit(handleStepSubmit)();
  };

  const isConfirmationStep = activeStep === CONFIRMATION_STEP_INDEX;

  return (
    <FormProvider {...methods}>
      <Container maxWidth="sm" sx={{ p: 0 }}>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
          {steps.map(({ id, label }, index) => (
            <Step key={id} completed={!!completedSteps[index]} sx={{ p: 0 }}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box component="form" onSubmit={handleFormSubmit}>
          <Box sx={{ mb: 7 }}>
            {activeStep === CONFIRMATION_STEP_INDEX
              ? <ConfirmationForm evaluationId={evaluationId} onPaid={() => setCompletedSteps((prev) => ({ ...prev, [CONFIRMATION_STEP_INDEX]: true }))} />
              : steps[activeStep]?.content}
          </Box>

          <Stack gap={2} justifyContent="flex-end">
            {activeStep > 0 && !isConfirmationStep && (
              <Button variant="soft" color="neutral" onClick={handleBack} sx={{ px: 4 }} disabled={submitting}>
                Back
              </Button>
            )}

            {!isConfirmationStep && (
              <Button type="submit" variant="soft" loading={submitting}>
                Save & Continue
              </Button>
            )}
          </Stack>
        </Box>
      </Container>
    </FormProvider>
  );
};

export default AddContactStepper;
