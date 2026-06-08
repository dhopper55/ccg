import { JSX, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Box, Button, Container, Stack, Step, StepLabel, Stepper, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import * as yup from 'yup';
import CompanyInfoForm, {
  CompanyInfo,
  companyInfoSchema,
} from 'components/sections/crm/add-contact/steps/CompanyInfoForm';
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
}

const steps: AddContactStepperStep[] = [
  {
    id: 1,
    label: (
      <Typography variant="subtitle2" fontWeight={700}>
        Guitar Info
      </Typography>
    ),
    content: <PersonalInfoForm label="Guitar Info" />,
  },
  {
    id: 2,
    label: (
      <Typography variant="subtitle2" fontWeight={700}>
        Photos
      </Typography>
    ),
    content: <CompanyInfoForm label="Photos" />,
  },
  {
    id: 3,
    label: (
      <Typography variant="subtitle2" fontWeight={700}>
        Contact Info
      </Typography>
    ),
    content: <LeadInfoForm label="Contact Info" />,
  },
];

const validationSchemas = [personalInfoSchema, companyInfoSchema, leadInfoSchema];

export interface ContactForm extends CompanyInfo, PersonalInfo, LeadInfo {}

const AddContactStepper = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const { enqueueSnackbar } = useSnackbar();
  const methods = useForm<ContactForm>({
    resolver: yupResolver(validationSchemas[activeStep] as yup.ObjectSchema<ContactForm>),
    defaultValues: {
      personalInfo: {},
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
    enqueueSnackbar('Contact added successfully', { variant: 'success' });
    reset();
    setCompletedSteps({});
    setActiveStep(0);
  };
  const handleStepClick = (step: number) => {
    setActiveStep(step);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (activeStep === steps.length - 1) {
      handleSubmit(onSubmit)();
    } else {
      handleNext();
    }
  };

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
            {activeStep > 0 && (
              <Button variant="soft" color="neutral" onClick={handleBack} sx={{ px: 4 }}>
                Back
              </Button>
            )}

            {activeStep === steps.length - 1 ? (
              <Button type="submit" variant="soft" sx={{ px: 4 }}>
                Save
              </Button>
            ) : (
              <Button type="submit" variant="soft">
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
