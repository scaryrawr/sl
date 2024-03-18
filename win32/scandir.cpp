#include "../scandir.h"

#include <filesystem>
#include <memory>
#include <ranges>
#include <string>
#include <vector>

int alphasort(const dirent **lhs, const dirent **rhs)
{
    return wcscmp((*lhs)->d_name, (*rhs)->d_name);
}

int scandir(const char *dirp, dirent ***namelist, filter_t filter, compar_t compar)
try
{
    if (!namelist)
    {
        return 0;
    }

    *namelist = nullptr;

    struct FreeDeleter
    {
        void operator()(dirent *p) const
        {
            free(p);
        }
    };
    using unique_dirent = std::unique_ptr<dirent, FreeDeleter>;

    auto vec = std::filesystem::directory_iterator(std::filesystem::path(dirp)) | std::views::transform([](const std::filesystem::directory_entry &entry)
                                                                                                        {
        unique_dirent temp{reinterpret_cast<dirent*>(malloc(sizeof(dirent)))};
        if (temp)
        {
            wcscpy_s(temp->d_name, MAX_PATH, entry.path().stem().c_str());
        }
        return temp; }) |
               std::views::filter([filter](const unique_dirent &entry)
                                  { return entry || (filter && !filter(entry.get())); }) |
               std::ranges::to<std::vector<unique_dirent>>();

    dirent **result{static_cast<dirent **>(malloc(vec.size() * sizeof(dirent *)))};
    if (!result)
    {
        return 0;
    }

    std::ranges::transform(vec, result, [](unique_dirent &entry)
                           { return entry.release(); });

    if (compar)
    {
        qsort(result, vec.size(), sizeof(dirent *), reinterpret_cast<int (*)(const void *, const void *)>(compar));
    }

    *namelist = result;
    return vec.size();
}
catch (...)
{
    return 0;
}