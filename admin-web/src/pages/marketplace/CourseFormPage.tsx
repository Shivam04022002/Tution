import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as coursesApi from '../../api/courses';
import { ApiError } from '../../api/client';
import { Card, CardHeader } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Select, TextArea, TextInput } from '../../components/ui/Form';
import { useToast } from '../../components/ui/Toast';
import { ErrorState, InlineLoader } from '../../components/common/States';
import { IconChevronLeft } from '../../components/ui/Icons';
import { COURSE_CATEGORIES, COURSE_LEVELS } from '../../utils/constants';
import type { CourseAccessType, CourseLevel } from '../../types';

/**
 * Course editor. The fields are exactly the ones `adminCourseController`
 * accepts on create/update — title, description, categoryId, level, accessType,
 * price and thumbnailUrl. Nothing else is stored on the model, so nothing else
 * is offered.
 */
export function CourseFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const existing = useQuery({
    queryKey: ['admin', 'course', id],
    queryFn: () => coursesApi.getCourse(id!),
    enabled: isEdit,
  });

  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryId: '',
    level: 'beginner' as CourseLevel,
    accessType: 'free' as CourseAccessType,
    price: '',
    thumbnailUrl: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);

  // Fill the form once the existing course arrives, without clobbering edits.
  useEffect(() => {
    if (!isEdit || hydrated || !existing.data) return;
    const course = existing.data.course;
    setForm({
      title: course.title,
      description: course.description,
      categoryId: course.categoryId,
      level: course.level,
      accessType: course.accessType,
      price: course.price ? String(course.price) : '',
      thumbnailUrl: course.thumbnailUrl ?? '',
    });
    setHydrated(true);
  }, [isEdit, hydrated, existing.data]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        categoryId: form.categoryId,
        level: form.level,
        accessType: form.accessType,
        price: form.accessType === 'paid' ? Number(form.price) : 0,
        thumbnailUrl: form.thumbnailUrl.trim() || undefined,
      };
      return isEdit ? coursesApi.updateCourse(id!, payload) : coursesApi.createCourse(payload);
    },
    onSuccess: (course) => {
      toast.success(isEdit ? 'Course updated' : 'Course created');
      queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'course', course._id] });
      navigate(isEdit ? `/marketplace/courses/${course._id}` : `/marketplace/courses/${course._id}/content`);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setErrors(
          Object.fromEntries(error.fieldErrors.map((fieldError) => [fieldError.field, fieldError.message]))
        );
        toast.error(error.message);
      } else {
        toast.error('Could not save the course.');
      }
    },
  });

  function submit() {
    const nextErrors: Record<string, string> = {};

    if (!form.title.trim()) nextErrors.title = 'Title is required';
    else if (form.title.trim().length > 160) nextErrors.title = 'Title must be 160 characters or fewer';

    if (!form.description.trim()) nextErrors.description = 'Description is required';
    else if (form.description.trim().length > 5000)
      nextErrors.description = 'Description must be 5000 characters or fewer';

    if (!form.categoryId) nextErrors.categoryId = 'Choose a category';

    if (form.accessType === 'paid') {
      const price = Number(form.price);
      if (!Number.isFinite(price) || price <= 0)
        nextErrors.price = 'Paid courses require a price greater than zero';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    save.mutate();
  }

  if (isEdit && existing.isLoading) {
    return (
      <div className="page">
        <InlineLoader label="Loading course…" />
      </div>
    );
  }

  if (isEdit && existing.isError) {
    return (
      <div className="page">
        <Card>
          <ErrorState error={existing.error} onRetry={() => existing.refetch()} />
        </Card>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <Link
        to={isEdit ? `/marketplace/courses/${id}` : '/marketplace/courses'}
        className="btn btn-ghost btn-sm"
        style={{ marginBottom: 12 }}
      >
        <IconChevronLeft size={14} /> {isEdit ? 'Back to course' : 'All courses'}
      </Link>

      <div className="page-head">
        <div>
          <h1 className="page-title">{isEdit ? 'Edit course' : 'New course'}</h1>
          <p className="page-sub">
            {isEdit
              ? 'Changes apply to the parent marketplace as soon as they are saved.'
              : 'Create the course shell first, then add lessons and videos.'}
          </p>
        </div>
      </div>

      <Card padded={false}>
        <CardHeader title="Course details" />
        <div className="card-body">
          <div className="form-grid">
            <TextInput
              className="span-2"
              label="Course title"
              required
              maxLength={160}
              value={form.title}
              error={errors.title}
              hint={`${form.title.length}/160 characters`}
              onChange={(event) => update('title', event.target.value)}
            />

            <TextArea
              className="span-2"
              label="Description"
              required
              rows={5}
              maxLength={5000}
              value={form.description}
              error={errors.description}
              hint={`${form.description.length}/5000 characters. Shown on the course page in the app.`}
              onChange={(event) => update('description', event.target.value)}
            />

            <Select
              label="Category"
              required
              value={form.categoryId}
              error={errors.categoryId}
              placeholder="Select a category"
              options={COURSE_CATEGORIES.map((category) => ({
                value: category.id,
                label: `${category.emoji}  ${category.name}`,
              }))}
              onChange={(event) => update('categoryId', event.target.value)}
            />

            <Select
              label="Level"
              value={form.level}
              options={COURSE_LEVELS}
              onChange={(event) => update('level', event.target.value as CourseLevel)}
            />

            <Select
              label="Access"
              value={form.accessType}
              options={[
                { value: 'free', label: 'Free' },
                { value: 'paid', label: 'Paid' },
              ]}
              hint="Free courses enrol instantly; paid courses go through checkout."
              onChange={(event) => {
                const next = event.target.value as CourseAccessType;
                update('accessType', next);
                if (next === 'free') update('price', '');
              }}
            />

            <TextInput
              label="Price (INR)"
              type="number"
              min={1}
              step={1}
              value={form.price}
              error={errors.price}
              disabled={form.accessType === 'free'}
              hint={
                form.accessType === 'free'
                  ? 'Free courses are stored with a price of 0.'
                  : 'Must be greater than zero.'
              }
              onChange={(event) => update('price', event.target.value)}
            />

            <TextInput
              className="span-2"
              label="Thumbnail URL"
              type="url"
              value={form.thumbnailUrl}
              error={errors.thumbnailUrl}
              placeholder="https://…"
              hint="The course model stores a thumbnail URL. There is no image upload endpoint for course art — host the image and paste its URL."
              onChange={(event) => update('thumbnailUrl', event.target.value)}
            />
          </div>

          {form.thumbnailUrl.trim() && (
            <div className="mt-6">
              <p className="label">Thumbnail preview</p>
              <img
                src={form.thumbnailUrl}
                alt=""
                style={{
                  marginTop: 8,
                  width: 240,
                  height: 135,
                  objectFit: 'cover',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--c-border)',
                  background: 'var(--c-bg-2)',
                }}
                onError={(event) => {
                  (event.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        <div className="card-foot row gap-2" style={{ justifyContent: 'flex-end' }}>
          <Button
            variant="secondary"
            disabled={save.isPending}
            onClick={() => navigate(isEdit ? `/marketplace/courses/${id}` : '/marketplace/courses')}
          >
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            {isEdit ? 'Save changes' : 'Create course'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
