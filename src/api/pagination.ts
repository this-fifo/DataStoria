export async function* paginate<T>(
	fetcher: (pageToken?: string) => Promise<{ items: T[]; nextPageToken?: string }>,
): AsyncIterable<{ items: T[]; nextPageToken?: string }> {
	let pageToken: string | undefined;
	do {
		const response = await fetcher(pageToken);
		yield response;
		pageToken = response.nextPageToken;
	} while (pageToken);
}
