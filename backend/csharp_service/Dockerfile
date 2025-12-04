FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["BavaxeCSharpService.csproj", "./"]
RUN dotnet restore "BavaxeCSharpService.csproj"
COPY . .
WORKDIR "/src"
RUN dotnet build "BavaxeCSharpService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "BavaxeCSharpService.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .
EXPOSE 6000
ENTRYPOINT ["dotnet", "BavaxeCSharpService.dll"]

