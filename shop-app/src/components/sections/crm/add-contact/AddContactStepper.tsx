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

const AddContactStepper = () => {
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

  const handleNext = async () => {
    const isValid = await methods.trigger();
    if (isValid) {
      setCompletedSteps((prev) => ({ ...prev, [activeStep]: true }));
      setActiveStep((prevStep) => prevStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const onSubmit = async (data: ContactForm) => {
    const resolvedBrand =
      data.personalInfo?.brand === 'Other'
        ? (data.personalInfo?.brandOther ?? 'Other')
        : data.personalInfo?.brand;

    const payload = {
      serialNumber: data.personalInfo?.serialNumber || null,
      brand: resolvedBrand,
      brandOther: data.personalInfo?.brandOther || null,
      model: data.personalInfo?.model || null,
      includesCase: data.personalInfo?.includesCase,
      location: data.personalInfo?.location || null,
      note: data.personalInfo?.note,
      damage: data.personalInfo?.damage,
      firstName: data.leadInfo?.firstName,
      lastName: data.leadInfo?.lastName,
      email: data.leadInfo?.email,
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/guitar-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || 'Submission failed');
      }
      const result = await res.json() as { id: number };
      setEvaluationId(result.id);
      setCompletedSteps((prev) => ({ ...prev, [activeStep]: true }));
      setActiveStep(CONFIRMATION_STEP_INDEX);
    } catch (e: any) {
      enqueueSnackbar(e?.message ?? 'Something went wrong. Please try again.', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (activeStep === CONFIRMATION_STEP_INDEX) return;

    if (activeStep === CONFIRMATION_STEP_INDEX - 1) {
      handleSubmit(onSubmit)();
    } else {
      handleNext();
    }
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
