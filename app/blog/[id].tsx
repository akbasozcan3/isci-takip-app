import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

export default function ArticleDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = String(params.id || '');

  React.useEffect(() => {
    // Redirect to blog index with selected id param so the page opens that article
    router.replace({ pathname: '/blog', params: { id } } as any);
  }, []);

  return null;
}
