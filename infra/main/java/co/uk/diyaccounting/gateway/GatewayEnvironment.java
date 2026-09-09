/*
 * SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
 * Copyright (C) 2006-2026 DIY Accounting Limited
 */


package co.uk.diyaccounting.gateway;

import static co.uk.diyaccounting.gateway.utils.Kind.envOr;
import static co.uk.diyaccounting.gateway.utils.Kind.infof;

import co.uk.diyaccounting.gateway.stacks.GatewayStack;
import co.uk.diyaccounting.gateway.utils.KindCdk;
import java.util.ArrayList;
import java.util.List;
import software.amazon.awscdk.App;
import software.amazon.awscdk.Environment;

/**
 * CDK entry point for the gateway account. Deploys a single GatewayStack
 * containing S3 + CloudFront for the diyaccounting.co.uk static site.
 * <p>
 * No Route53 records are created here — those live in the root account
 * and are managed by the root.diyaccounting.co.uk repository.
 */
public class GatewayEnvironment {

    public final GatewayStack gatewayStack;

    public static void main(final String[] args) {
        App app = new App();

        var envName = envOr("ENVIRONMENT_NAME", KindCdk.getContextValueString(app, "envName", "ci"));
        var certificateArn = envOr("CERTIFICATE_ARN", KindCdk.getContextValueString(app, "certificateArn", ""));
        var docRootPath = envOr(
                "DOC_ROOT_PATH",
                KindCdk.getContextValueString(app, "docRootPath", "../web/www.diyaccounting.co.uk/public"));
        var domainNamesStr = envOr("DOMAIN_NAMES", KindCdk.getContextValueString(app, "domainNames", ""));
        var prodFQDomainName = KindCdk.getContextValueString(app, "prodFQDomainName", "");
        var prodFQNakedDomainName = KindCdk.getContextValueString(app, "prodFQNakedDomainName", "");

        List<String> domainNames;
        if (!domainNamesStr.isBlank()) {
            domainNames = List.of(domainNamesStr.split(","));
        } else {
            var names = new ArrayList<String>();
            names.add(envName + "-gateway.diyaccounting.co.uk");
            if ("prod".equals(envName)) {
                if (!prodFQDomainName.isBlank()) names.add(prodFQDomainName);
                if (!prodFQNakedDomainName.isBlank()) names.add(prodFQNakedDomainName);
            }
            domainNames = List.copyOf(names);
        }

        var gateway = new GatewayEnvironment(app, envName, certificateArn, docRootPath, domainNames);
        app.synth();
        infof("CDK synth complete for gateway environment");
    }

    public GatewayEnvironment(
            App app, String envName, String certificateArn, String docRootPath, List<String> domainNames) {
        // CloudFront requires us-east-1 for certificates
        Environment usEast1Env = Environment.builder()
                .region("us-east-1")
                .account(KindCdk.buildPrimaryEnvironment().getAccount())
                .build();

        String stackId = envName + "-gateway-GatewayStack";
        infof("Synthesizing stack %s for environment %s", stackId, envName);

        this.gatewayStack = new GatewayStack(
                app,
                stackId,
                GatewayStack.GatewayStackProps.builder()
                        .env(usEast1Env)
                        .envName(envName)
                        .certificateArn(certificateArn)
                        .docRootPath(docRootPath)
                        .domainNames(domainNames)
                        .build());
    }
}
