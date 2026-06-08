import { JSX, useState } from 'react';
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
        Confirmation
      </Typography>
    ),
    content: <ConfirmationForm label="Confirmation" />,
    hasValidation: false,
  },
];

const validationSchemas = [personalInfoSchema, companyInfoSchema, leadInfoSchema];

export interface ContactForm extends CompanyInfo, PersonalInfo, LeadInfo {}

const AddContactStepper = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
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
      companyInfo: {},
      leadInfo: {},
    },
  });

  const { handleSubmit, reset } = methods;

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

  const onSubmit = (data: any) => {
    console.log('Form data', data);
    enqueueSnackbar('Evaluation request submitted!', { variant: 'success' });
    setCompletedSteps((prev) => ({ ...prev, [activeStep]: true }));
    setSubmitted(true);
    setActiveStep(CONFIRMATION_STEP_INDEX);
  };

  const handleStepClick = (step: number) => {
    setActiveStep(step);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (activeStep === CONFIRMATION_STEP_INDEX) {
      // Already confirmed — no-op
      return;
    }

    if (activeStep === CONFIRMATION_STEP_INDEX - 1) {
      // Last data-entry step: validate then submit
      handleSubmit(onSubmit)();
    } else {
      handleNext();
    }
  };

  const isConfirmationStep = activeStep === CONFIRMATION_STEP_INDEX;

  return (
    <FormProvider {...methods}>
      <Container maxWidth="sm" sx={{ p: 0 }}>
        <Stepper nonLinear activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
          {steps.map(({ id, label }, index) => (
            <Step key={id} completed={!!completedSteps[index]} sx={{ p: 0 }}>
              <StepLabel onClick={() => handleStepClick(index)} sx={{ cursor: 'pointer' }}>
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box component="form" onSubmit={handleFormSubmit}>
          <Box sx={{ mb: 7 }}>{steps[activeStep]?.content}</Box>

          <Stack gap={2} justifyContent="flex-end">
            {activeStep > 0 && !isConfirmationStep && (
              <Button variant="soft" color="neutral" onClick={handleBack} sx={{ px: 4 }}>
                Back
              </Button>
            )}

            {!isConfirmationStep && (
              <Button type="submit" variant="soft">
                {activeStep === CONFIRMATION_STEP_INDEX - 1 ? 'Save & Continue' : 'Save & Continue'}
              </Button>
            )}
          </Stack>
        </Box>
      </Container>
    </FormProvider>
  );
};

export default AddContactStepper;
