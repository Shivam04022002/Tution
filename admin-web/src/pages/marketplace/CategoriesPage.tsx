import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as coursesApi from '../../api/courses';
import { Card, CardHeader } from '../../components/ui/Primitives';
import { Badge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/common/ListToolbar';
import { ErrorState, InlineLoader } from '../../components/common/States';
import { TableWrap } from '../../components/ui/Table';
import { COURSE_CATEGORIES } from '../../utils/constants';
import { formatNumber } from '../../utils/format';

/**
 * Categories are a fixed constant shared by the app and this console
 * (`tuition-mobile/src/constants/courseCategories.ts`) — the backend stores only
 * the `categoryId` string on a course and exposes no category CRUD. This screen
 * therefore reports the catalogue and how courses are distributed across it,
 * rather than pretending to offer editing the API does not support.
 */
export function CategoriesPage() {
  // One request per category would be wasteful; a single unfiltered page of
  // courses is enough to count distribution up to the server's 50-row cap.
  const query = useQuery({
    queryKey: ['admin', 'courses', 'category-distribution'],
    queryFn: () => coursesApi.listCourses({ page: 1, limit: 50 }),
  });

  const counts = new Map<string, { total: number; published: number }>();
  for (const course of query.data?.courses ?? []) {
    const entry = counts.get(course.categoryId) ?? { total: 0, published: 0 };
    entry.total += 1;
    if (course.isPublished) entry.published += 1;
    counts.set(course.categoryId, entry);
  }

  const totalCourses = query.data?.summary.total ?? 0;
  const sampled = query.data?.courses.length ?? 0;
  const partial = totalCourses > sampled;

  return (
    <div className="page">
      <PageHeader
        title="Categories"
        subtitle="The marketplace category set shared by the app and this console."
      />

      <div
        className="card mb-4 text-sm muted"
        style={{ padding: 'var(--s-3) var(--s-4)', lineHeight: 1.6 }}
      >
        Categories are a fixed list in the codebase, not database records — a course stores its
        category as the <span className="mono">categoryId</span> string shown below. There is no
        category API, so adding or renaming one is a code change in both{' '}
        <span className="mono">tuition-mobile/src/constants/courseCategories.ts</span> and{' '}
        <span className="mono">admin-web/src/utils/constants.ts</span>, kept in step so existing
        courses keep resolving.
      </div>

      <Card padded={false}>
        <CardHeader
          title="Category catalogue"
          subtitle={
            partial
              ? `Distribution measured across the ${sampled} most recently updated of ${totalCourses} courses`
              : `Distribution across all ${totalCourses} courses`
          }
        />

        {query.isLoading && <InlineLoader />}
        {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}

        {query.isSuccess && (
          <TableWrap>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Category ID</th>
                  <th className="num">Courses</th>
                  <th className="num">Published</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {COURSE_CATEGORIES.map((category) => {
                  const entry = counts.get(category.id) ?? { total: 0, published: 0 };
                  return (
                    <tr key={category.id}>
                      <td>
                        <span className="row gap-2">
                          <span style={{ fontSize: 16 }}>{category.emoji}</span>
                          <span className="cell-primary">{category.name}</span>
                        </span>
                      </td>
                      <td>
                        <span className="mono muted">{category.id}</span>
                      </td>
                      <td className="num">{formatNumber(entry.total)}</td>
                      <td className="num">
                        {entry.published > 0 ? (
                          <Badge tone="success">{entry.published}</Badge>
                        ) : (
                          <span className="dim">0</span>
                        )}
                      </td>
                      <td className="actions">
                        <Link
                          to={`/marketplace/courses?categoryId=${category.id}`}
                          className="btn btn-ghost btn-sm"
                        >
                          View courses
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
